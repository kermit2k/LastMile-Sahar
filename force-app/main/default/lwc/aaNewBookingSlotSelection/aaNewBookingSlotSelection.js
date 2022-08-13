import { LightningElement, wire, track, api } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import getSlotAsPerStartDate from '@salesforce/apex/AANewBookingController.getSlotsAsPerEarliestStartDate';
import getSplunkLogs from  '@salesforce/apex/AANewBookingController.callNewBookingSplunklogs';
import cloneSA from '@salesforce/apex/AANewBookingController.cloneSA';
import deleteSA from '@salesforce/apex/AANewBookingController.deleteSA';
import convertTimeToOtherTimeZone from '@salesforce/apex/AANewBookingController.convertTimeToOtherTimeZone';
import customLabels from './labels';
import { FlowNavigationNextEvent } from 'lightning/flowSupport';

export default class aaNewBookingSlotSelection extends LightningElement {

    LABELS = customLabels;
    @api timeSlotDateWise;
    timeSlotWiseTemp = [];
    @api operatingHoursId;
    @api schedulingPolicyId;
    @api selectedHorizonValue;
    @api maxDayToGetAppointmentSlots;
    inFlowMode = true;
    @api selectedService;
    @api showDataSpinner = false;
    dummySAid;
    dummyWO;
    timeZoneOfDummySA;
    
    show_RescheduleAppointmentScreen = true;
    @api isInEditorMode = false;
    @api noOfDaysBeforeAfterWeek = 2;
    @api show_communityBuilderScreen = false;

    show_CalendarScreen = false;
    show_InvalidPage = false;
    show_cancelScreen = false;

    @track selectedDate;
    @track buttonClickName;
    serviceAppointmentDueDate;
    
    @api maxValidCalendarDate;
    @api minValidCalendarDate;

    @api selectedServiceDisplayName;
    @api selectedServiceObjName;

    //ADDRESS FIELDS 
    @api street = '';
    @api city = '';
    @api state = '';
    @api country = '';
    @api zipCode = '';
    @api latitude;
    @api longitude;
    @api serviceTerritoryid;

    SCHEDULING_UNIT_DAY = "Days";
    SCHEDULING_UNIT_WEEK = "Weeks";
    SCHEDULING_UNIT_MONTH = "Months";

    // @api showExactArrivalTime;
    @api selectedHorizonUnit;
    @api ArrivalWindowMethod;
    @api ArrivalWindowStartTime;
    @api ArrivalWindowEndTime;
    @api ActualArrivalWindowStartTime;
    @api ActualArrivalWindowEndTime;
    child_ConfirmClass = 'c-aa-confirm-appointment-page';
    child_RescheduleClass = 'c-aa-reschedule-appointment';
    @api earliestStartPermitted;
    @api dueDate;

    @api pageTitle;

    @api get appointmentAssistanceSlotSelectionTitle(){
        return (this.pageTitle? this.pageTitle : this.LABELS.Appointment_ReBooking_select_an_available_appointment_time);
    } 

    connectedCallback(){
        console.log("Service territory id is : "+this.serviceTerritoryid);
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(currentPageReference) {
        this.callAPEX();
    }

    @api set schedulingHorizonUnit(value) {
            this.selectedHorizonUnit = value;
    } 
    get schedulingHorizonUnit() {
        return this.selectedHorizonUnit;
    }

    @api set sechedulingHorizonValue(value) {
        this.selectedHorizonValue = value;
    } 
    get sechedulingHorizonValue() {
        return this.selectedHorizonValue;
    }

    callAPEX() {
        this.runServiceAppointmentQuery();
        getSplunkLogs();
        //this.dataLoaded = true;
    }

    runServiceAppointmentQuery() {
        console.log("runServiceAppointmentQuery started");
        this.lockScrolling();

        if (this.earliestStartPermitted == null || new Date(this.earliestStartPermitted) < new Date()) {
            this.minValidCalendarDate = this.getDateWithoutTime(new Date());
            this.selectedDate = this.getDateWithoutTime(new Date());
        } else {
            this.minValidCalendarDate = this.getDateWithoutTime(new Date(this.earliestStartPermitted));
            this.selectedDate = this.getDateWithoutTime(new Date(this.earliestStartPermitted));
        }
        console.log("Earliest Start Permitted value is: "+ this.minValidCalendarDate);
        if (this.dueDate == null) {
            this.dueDate = new Date(this.minValidCalendarDate);
            this.dueDate.setDate(this.dueDate.getDate() + this.selectedHorizonValue);
        } else if (new Date(this.dueDate) <= this.minValidCalendarDate){
            console.log("**ERROR** Due Date is before Earliest Start Permitted!");
        } else {
            this.dueDate = new Date(this.dueDate);
        }
        console.log("Due Date value is: "+ this.dueDate);
        this.serviceAppointmentDueDate = new Date(this.dueDate);
        this.maxValidCalendarDate = this.calculateMaxValidHorizonDate();

        this.handleGetSlotQueryForSelectedDateRange(this.minValidCalendarDate);
    }

    onDateSelected(event) {
        this.selectedDate = event.detail.date;
        console.log('Selected date in main class : ' + this.selectedDate);
    }

    onButtonClick(event) {
        this.buttonClickName = event.detail.buttonName;
        switch (this.buttonClickName) {
            case 'rescheduleEvent': {
                this.showRescheduleScreen(true);
                break;
            }
            // case 'showConfirmScreen': {
            //     this.dateArrayForQuery = [];
            //     this.showConfirmScreen(true);
            //     break;
            // }
            case 'onMonthViewSelected' : {
                this.dateArrayForQuery = [];
                break;
            }
            default: {
            }
        }
    }

    dateArrayForQuery = [];
    /**
     * 
     * RUN THE APEX TO GET SLOTS FOR GIVE DATE
     * ROLL BACK THE FUNCTION ONCE THE SLOTS ARE RETRIVED
     */
    handleGetSlotQueryForSelectedDate(event) {
        var firstDateOfWeek = this.getFirstDayOfWeek(event.detail.selectedDate);
        console.log('handleGetSlotQueryForSelectedDate', firstDateOfWeek);
        this.handleGetSlotQueryForSelectedDateRange(firstDateOfWeek);
    }

    handleGetSlotQueryForSelectedDateRange(selectedDate) {
        console.log('handleGetSlotQueryForSelectedDateRange', selectedDate);
        var firstDateOfWeek = selectedDate;
        if(firstDateOfWeek <= new Date()) {
            firstDateOfWeek = new Date();
        }
        console.log('handleGetSlotQueryForSelectedDateRange', selectedDate);
        var lastDateOfWeek = this.getLastDayOfWeek(firstDateOfWeek, 0);
        if(lastDateOfWeek > this.maxValidCalendarDate) {
            lastDateOfWeek = this.maxValidCalendarDate;
        }
        console.log("First and Last date of the week : "+firstDateOfWeek + "      "+lastDateOfWeek);
        
        var loopdate = new Date(firstDateOfWeek);
        loopdate = new Date(this.getDateWithoutTime(loopdate));
        console.log("Date in the Array is : "+loopdate);
        console.log("this.dateArrayForQuery.indexOf(loopdate) + : "+loopdate+ "   and  "+this.isInArray(this.dateArrayForQuery, loopdate ));

        if(!this.isInArray(this.dateArrayForQuery, loopdate )) {

            console.log('Address is : '+this.street);
            //If the date is not added in cache, run the below code to add it and get fresh slots
            this.addDatesToCashArray(new Date(loopdate),new Date(loopdate));

            console.log("getSlot As Per StartDate :  "+loopdate +" Minvalid Calendar date : "+this.minValidCalendarDate);
            if(loopdate >= this.minValidCalendarDate) {
                
                this.lockScrolling();
                console.log("Run appointment query for  date "+loopdate);

                // IF THE DATE IS AFTER ARRIVAL WINDOW START DATE
                console.log('clone sa method called ');
                cloneSA({ startPermitDate: loopdate, 
                        selectedHorizonValue: this.selectedHorizonValue, 
                        workTypeName: this.selectedService.split('&D')[0],
                        street: this.street,
                        city: this.city,
                        state: this.state,
                        country: this.country,
                        zipCode: this.zipCode,
                        latitude: this.latitude,
                        longitude: this.longitude,
                        dummySA: this.dummySAid,
                        dummyWO: this.dummyWO,
                        serviceTerritoryId: this.serviceTerritoryid
                    })
                .then((saData) => {
                    if(saData.said) {
                        this.dummySAid = saData.said;
                        this.dummyWO = saData.woid;
                        console.log('clone sa method finished');

                        this.sleep(3000).then(() => {
                            var lcaletime = Intl.DateTimeFormat().resolvedOptions().timeZone;
                            console.log('getSlots method called');
                            getSlotAsPerStartDate({ SAID: saData.said,
                                selectedHorizonValue: this.selectedHorizonValue,
                                operatingHoursId: this.operatingHoursId,
                                schedulingPolicyId: this.schedulingPolicyId,
                                arrivalWindowFlag: this.ArrivalWindowMethod,
                                localetimezone:  lcaletime})
                            .then((data) => {
                                
                                console.log('Time zone of the sa is : '+data.timeZone);
                                this.timeZoneOfDummySA = data.timeZone;
                                //this.removeOrDeleteSA(saData.said, saData.woid);
                                
                                if(data.error) {
                                    console.log('Error in getting slots : '+data.error);
                                    this.showAlertWithError(this.LABELS.AppointmentAssistance_confirmation_failure_message);
                                    this.timeSlotDateWise = [];
                                    this.removeOrDeleteSA(saData.said, saData.woid);
                                } else {
                
                                    this.timeSlotWiseTemp = data.timeslotList;
                                    this.timeSlotDateWise = this.timeSlotWiseTemp;
                                    //var lastDateOfSlot = this.getLastSlotFromTheArray(this.timeSlotWiseTemp);
                                    
    
                                    var tempDate = loopdate.setDate(loopdate.getDate() + this.maxDayToGetAppointmentSlots);
                                    loopdate = new Date(tempDate);
                                    console.log('New Loop date is : '+loopdate + "   and last day of week is : "+lastDateOfWeek);
                                    if(loopdate <= lastDateOfWeek) {
                                        this.lockScrolling();
                                        this.handleGetSlotQueryForSelectedDateRange(loopdate);
                                    } else {
                                        this.removeOrDeleteSA(saData.said, saData.woid);
                                    }
                                }
                            }).catch(error=>{
                                this.removeOrDeleteSA(saData.said, saData.woid);
                                console.log('Error while executing FSL API :', + error);
                                this.timeSlotDateWise = [];
                                this.allowScrolling();
                            })                   
                        });

                    } else if(saData.error) {
                        console.log('Errror while creating dummy SA  :', + error);
                        this.timeSlotDateWise = [];
                        this.allowScrolling();
                    }

                    this.showDataSpinner = true;


                }).catch(error => {
                    // delete SA/WO incase transaction fails
                    //this.removeOrDeleteSA(saData.said, saData.woid);
                    this.showDataSpinner = false;
                    console.log('Errror while creating dummy SA  :', + error);
                    this.timeSlotDateWise = [];
                    this.allowScrolling();
                })
                
            } else { 
                // IF THE DATE IS BEFORE ARRIVAL WINDOW START DATE
                console.log('Loop date is less than minimum valid date');
                // loopdate = new Date(this.minValidCalendarDate);
                var tempDate = loopdate.setDate(loopdate.getDate() + this.maxDayToGetAppointmentSlots);
                loopdate = new Date(tempDate);
                if(loopdate <= lastDateOfWeek) {
                    this.showDataSpinner = true;
                    this.handleGetSlotQueryForSelectedDateRange(loopdate);
                } else {
                    this.timeSlotDateWise = this.timeSlotWiseTemp;
                    this.allowScrolling();
                }
            }
            
        } else {
            // If the date are already cache, take the slot from it and run the query for next date;
            var tempDate = loopdate.setDate(loopdate.getDate() + this.maxDayToGetAppointmentSlots);
            loopdate = new Date(tempDate);

            if(loopdate <= lastDateOfWeek) {
                this.handleGetSlotQueryForSelectedDateRange(loopdate);
            } else {
                this.timeSlotDateWise = [];
            }
        }
    }

    removeOrDeleteSA(said, woid) {
        this.showDataSpinner = true;
        deleteSA({SAID: said, WOID: woid})
        .then((deleteData) => {
            this.showDataSpinner = false;
            if(deleteData.said) {
                this.dummySAid = null;
                this.dummyWO = null;
                console.log(deleteData.said);
                console.log(deleteData.woid);
            }
            else
                console.log('Error while deleting the service appointment');
        }).catch( error => {
            this.allowScrolling();
            console.log('Error while deleting the service appointment');
        })
    }

    convertTZ(date, tzString, offSetDifference) {
        return new Date((typeof date === "string" ? new Date(date) : date).toLocaleString("en-US", {timeZone: tzString}));   
    }


    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
      
    
    onServiceAppointmentUpdate(event) {
        

        this.ArrivalWindowStartTime = event.detail.selectedSlotStart;
        this.ArrivalWindowEndTime = event.detail.selectedSlotEnd;

        this.ActualArrivalWindowStartTime = event.detail.selectedSlotStart;
        this.ActualArrivalWindowEndTime = event.detail.selectedSlotEnd;

        console.log('Arrival window start is : '+this.ArrivalWindowStartTime);
        console.log('Arrival window end is : '+this.ArrivalWindowEndTime);
        console.log('New timezone is : '+this.convertTZ(this.ArrivalWindowStartTime, this.timeZoneOfDummySA));

        /**
         * CONVERT THE TIME FROM LOCALE TO SERVER
         */

        convertTimeToOtherTimeZone({    date1: this.ArrivalWindowStartTime,
                                        date2: this.ArrivalWindowEndTime,
                                        targetTimezone:  this.timeZoneOfDummySA,
                                        sourceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone 
                                })
        .then((data) => {

            console.log('Date converted from apex is : '+new Date(data.date1));
            console.log('Date converted from apex is : '+new Date(data.date2));
            
            this.ArrivalWindowStartTime = new Date(data.date1);
            this.ArrivalWindowEndTime = new Date(data.date2);
            const navigateNextEvent = new FlowNavigationNextEvent();
            this.dispatchEvent(navigateNextEvent);

        }).catch(error => {
            console.log('error is : '+error);
        })
    }

    isValidDate(d) {
        return d instanceof Date && !isNaN(d);
    }

    isInArray(array, value) {
        for (var i = 0; i < array.length; i++) {
            if (value.getTime() == array[i].getTime()) {
                return true;
            }
        }
        return false;
    }

    addDatesToCashArray(start, end) {
        var currentDate = start; 
        while (currentDate <= end) { 
            var addingDate = new Date(currentDate);
            this.dateArrayForQuery.push(addingDate);  
            var tempDate = currentDate.setDate(currentDate.getDate() + 1);
            currentDate = new Date(tempDate);  
        } 
        this.dateArrayForQuery = Array.from(new Set(this.dateArrayForQuery));
    }

    getLastSlotFromTheArray(slotArray) {
        var lastdate;
        if(slotArray.length > 0) {
            var timeSlot = slotArray[slotArray.length - 1].split('#');
            lastdate = this.getDateWithoutTime(timeSlot[0]);
            console.log("Last Date from the slots is : "+lastdate);
        }
        return lastdate;
    }

    getDateWithoutTime(date) {
        var d;
        if (typeof val === 'string') {
            d = new Date(date.replace(/-/g, "/"));   // replace method is use to support time in safari
        } else {
            d = new Date(date);
        }
        d.setHours(0, 0, 0, 0);
        return d;
    }

    getFirstDayOfWeek(date, index) {
        var start = index >= 0 ? index : 0;
        var d = new Date(date);
        var day = d.getDay();
        var diff = d.getDate() - day + (start > day ? start - 7 : start);
        d.setDate(diff);
        console.log('First day of week is : ' + d.getDate());
        var newDate = new Date(d.setDate(d.getDate() - this.noOfDaysBeforeAfterWeek));
        return newDate;
    };

    getLastDayOfWeek(date, index) {
        var start = index >= 0 ? index : 0;
        var d = new Date(date);
        var day = d.getDay();
        var diff = d.getDate() - day + (start > day ? start - 1 : 6 + start);
        d.setDate(diff);
        var newDate = new Date(d.setDate(d.getDate() + this.noOfDaysBeforeAfterWeek));
        return newDate;
    };

    convertDateUTCtoLocal(date) {
        if(date && date !== 'null') {
          return new Date((date.replace(/ /g,"T") + '.000Z'));
        } else {
          return '';
        }
    }

    showRescheduleScreen(value) {
        this.show_cancelScreen = !value;
        this.show_RescheduleAppointmentScreen = value;
        this.show_ConfirmAppointmentScreen = !value;
    }

    showAlertWithError(errorMessage) {
        alert(errorMessage);
    }

    calculateMaxValidHorizonDate() {
        console.log('-- this.selectedHorizonValue', this.selectedHorizonValue);
        console.log('-- this.selectedHorizonUnit', this.selectedHorizonUnit);
        if(this.selectedHorizonValue && this.selectedHorizonUnit) {
            // var currentDate = new Date();
            var currentDate = this.minValidCalendarDate > new Date() ? new Date(this.minValidCalendarDate) : new Date();
            var targetDate;
            switch(this.selectedHorizonUnit) {
                case this.SCHEDULING_UNIT_WEEK:
                    targetDate = new Date(currentDate.setDate(currentDate.getDate() + this.selectedHorizonValue*7));
                break;
                case this.SCHEDULING_UNIT_MONTH:
                    targetDate = new Date(currentDate.setMonth(currentDate.getMonth() + this.selectedHorizonValue));
                break;
                default: //this.SCHEDULING_UNIT_DAY
                    targetDate = new Date(currentDate.setDate(currentDate.getDate() + this.selectedHorizonValue));
            }
            console.log("Max valid date with Horizon Value is : "+targetDate);
            if(this.serviceAppointmentDueDate < targetDate) {
                console.log("Max valid date is past the SA Due Date: "+this.serviceAppointmentDueDate);
                return this.serviceAppointmentDueDate;
            } else
                return targetDate;
        } else {
            return this.serviceAppointmentDueDate;
        }
    }

    allowScrolling() {
        document.body.style.overflow = 'auto';
        this.showDataSpinner = false;
    }
    lockScrolling() {
        document.body.style.overflow = 'hidden';
        this.showDataSpinner = true;
    }

}
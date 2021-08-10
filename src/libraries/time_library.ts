/**
 * 현재 영업시간인지 확인
 */
export function checkWorkingTime(timeZone:string = "Asia/Seoul") {
    const date:Date = new Date((new Date()).toLocaleDateString("ko-KR", {timeZone: timeZone}));
    let worktime:boolean = true;
    if(date.getDay() % 6 === 0) {
        worktime = false;
    } else {
        const month:number = date.getMonth();
        const day:number = date.getDate();
        const holidays:number[][] = [[8,16], [9,20], [9,21], [9,22], [10,4], [10,11], [12,27]];
        for(const holiday in holidays) {
            if((month+1) === parseInt(holiday[0]) && day === parseInt(holiday[1])) {
                worktime = false;
            }
        }
    }
    if(worktime) {
        const hour:number = parseInt(((new Date()).toLocaleTimeString("ko-KR", {timeZone: timeZone, hour: 'numeric', minute: 'numeric', hour12: false})).split(':')[0]);
        if(hour < 8 || hour >= 17) {
            worktime = false;
        }
    }
    return worktime;
}

export interface datetimeStringOptions {
    changeYearBy?:number;
    changeMonthBy?:number;
    changeDateBy?:number;
    changeHourBy?:number;
    changeMinuteBy?:number;
    changeSecondBy?:number;
}

export function datetimeString(timeZone:string = "ISO", options:datetimeStringOptions) {
    let date:Date = new Date();
    if(typeof options.changeYearBy !== 'undefined') {
        date.setFullYear(date.getFullYear()+options.changeYearBy);
    }
    if(typeof options.changeMonthBy !== 'undefined') {
        date.setMonth(date.getMonth()+options.changeMonthBy);
    }
    if(typeof options.changeDateBy !== 'undefined') {
        date.setDate(date.getDate()+options.changeDateBy);
    }
    if(typeof options.changeHourBy !== 'undefined') {
        date.setDate(date.getDate()+options.changeHourBy);
    }
    if(typeof options.changeMinuteBy !== 'undefined') {
        date.setDate(date.getDate()+options.changeMinuteBy);
    }
    if(typeof options.changeSecondBy !== 'undefined') {
        date.setDate(date.getDate()+options.changeSecondBy);
    }

    let datetime:string;
    switch(timeZone) {
        default:
            datetime = date.toISOString().split('T')[0]+" "+(new Date()).toISOString().split('T')[1].split('.')[0];
    }
    return datetime;
}
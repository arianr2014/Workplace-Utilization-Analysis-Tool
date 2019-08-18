import React, {Component} from 'react';
import {Bar, Line} from 'react-chartjs-2';
import {
  Button,
  ButtonGroup,
  ButtonToolbar,
  Card,
  CardBody,
  CardFooter,
  CardTitle,
  Col,
  Progress,
  Row,
} from 'reactstrap';
import {CustomTooltips} from '@coreui/coreui-plugin-chartjs-custom-tooltips';
import {getStyle, hexToRgba} from '@coreui/coreui/dist/js/coreui-utilities'
import DashboardCard from "./DashboardCard";
import {checkTime, cleanData, createDateString, mainChartOpts, processSessions} from '../../utils/data-processing-utils'
//data stuff
import axios from 'axios';
import MONITOR_TYPE from '../../utils/monitorTypes';
import toast from 'toasted-notes'
import 'toasted-notes/src/styles.css';
import './../../scss/flatpickr-bgis.scss'

import Flatpickr from 'react-flatpickr'


//fetch color themes from css
const brandDark = getStyle('--theme-dark');
const brandLight = getStyle('--theme-light');
const brandNorm = getStyle('--theme-norm');
const brandBland = getStyle('--theme-bland');
const times = ['12am', '1am', '2am', '3am', '4am', '5am', '6am', '7am', '8am', '9am', '10am', '11am', '12pm', '1pm',
  '2pm', '3pm', '4pm', '5pm', '6pm', '7pm', '8pm', '9pm', '10pm', '11pm'];


const freeProjectorsCardOpts = {
  tooltips: {
    enabled: false,
    custom: CustomTooltips
  },
  maintainAspectRatio: false,
  legend: {
    display: false,
  },
  scales: {
    xAxes: [
      {
        display: false,
      }],
    yAxes: [
      {
        display: false,
      }],
  },
  elements: {
    line: {
      borderWidth: 2,
    },
    point: {
      radius: 0,
      hitRadius: 10,
      hoverRadius: 4,
    },
  },
};
const freeLaptopCardOpts = {...freeProjectorsCardOpts};
const freeDeskMonitorsCardOpts = {...freeProjectorsCardOpts};
const employeesOnlineCardOpts = {
  tooltips: {
    enabled: false,
    custom: CustomTooltips
  },
  maintainAspectRatio: false,
  legend: {
    display: false,
  },
  scales: {
    xAxes: [
      {
        display: false,
        barPercentage: 0.6,
      }],
    yAxes: [
      {
        display: false,
      }],
  },
};


// Main Chart



class Dashboard extends Component {
  constructor(props) {
    super(props);


    this.state = {
      dropdownOpen: false,
      radioSelected: 1,
      employeesOnlineCardData: {
        labels: times,
        datasets: [
          {
            label: '# of Employees Online',
            backgroundColor: 'rgba(255,255,255,.3)',
            borderColor: 'transparent',
            data: Array(24).fill(0),
          },
        ],
      },
      freeLaptopCardData: {
        labels: times,
        datasets: [
          {
            label: '% of Laptops Being Used',
            backgroundColor: 'rgba(255,255,255,.2)',
            borderColor: 'rgba(255,255,255,.55)',
            data: Array(24).fill(0),
          },
        ],
      },
      freeDeskMonitorsCardData: {
        labels: times,
        datasets: [
          {
            label: '% of Desk Monitors Being Used',
            backgroundColor: 'rgba(255,255,255,.2)',
            borderColor: 'rgba(255,255,255,.55)',
            data: Array(24).fill(0),
          },
        ],
      },
      freeProjectorsCardData: {
        labels: times,
        datasets: [
          {
            label: '% of Projectors Being Used',
            backgroundColor: 'rgba(255,255,255,.2)',
            borderColor: 'rgba(255,255,255,.55)',
            data: Array(24).fill(0),
          },
        ],
      },
      mainChartData : {
        labels: [],
        datasets: [],
      },
      date: new Date()


    };
  }

  componentDidMount() {
    axios('/api/data/list').then(dat => {
      this.processData(dat);
    })
  }

  onRadioBtnClick=(radioSelected)=> {
    this.setState({
      radioSelected: radioSelected,
      date: [this.state.date[0]]
    });
    this.dateChange(this.state.date);
  };
  dateChange = (dates) => {
    let datasets = [];
    let mainChartData = {...this.state.mainChartData};
    mainChartData.labels = dates.length === 1 ? times : dates.sort((a, b) => a - b).map(d => {
      return createDateString(d)

    });
    if (this.state.monitorsUsedPerTeam) {
      console.log(this.state.monitorsUsedPerTeam);
      for (let teamId in this.state.monitorsUsedPerTeam) {
        if (!this.state.monitorsUsedPerTeam.hasOwnProperty(teamId) || teamId === 'dates')
          continue;
        let team = this.state.teamIndex[teamId];
        let data = Array(dates.length === 1 ? 24 : dates.length).fill(0);
        if (dates.length === 1) {
          let day = this.state.monitorsUsedPerTeam[teamId][createDateString(dates[0])];
          if (day) {
            data = day.byHour;
          }
        } else
          for (let i = 0; i < dates.length; i++) {
            let dayMax = this.state.monitorsUsedPerTeam[teamId][createDateString(dates[i])];
            if (dayMax) {
              data[i] = dayMax.max;
            }
          }
        datasets.push({
          label: team.name,
          backgroundColor: hexToRgba(team.color, 10),
          borderColor: team.color,
          pointHoverBackgroundColor: '#fff',
          borderWidth: 2,
          data: data

        });

      }
      mainChartData.datasets = datasets;

    }
    this.setState({date: dates, mainChartData});
  };

  processData(raw) {//this method is terrible, and I know no better way of doing it, maybe I would have split it up into nicer methods if I had time.
    console.time('processData');
    let data = cleanData(raw);

    let newMonitor = false;
    data.monitors.forEach(monitor => {

      newMonitor = monitor.new;//also detect new monitors

    });
    if (newMonitor) {//and send alerting message if they exist
      toast.notify("A new Monitor has been discovered, make sure to review it!");
    }
    let date = new Date();
    let dateString = createDateString(date);

    //today
    //employees online at a specific hour
    let onlineToday = Array(24).fill(0);//key: hour of day, value: array of employees online at that time.
    //monitors free at a specific hour for each type
    let monitorsUsedToday = {}, monitorsUsedPerTeam = {};
    for (let type in MONITOR_TYPE) {//populate with the current amount of monitors per type.
      monitorsUsedToday[MONITOR_TYPE[type]] = Array(date.getHours() + 1).fill(0);
    }
    data.teams.forEach(team => {
      monitorsUsedPerTeam[team._id] = {};
    });
    monitorsUsedPerTeam.dates = [];
    data.teams.forEach(team => {
      team.employees.forEach(employee => {
        employee.usageData.forEach(date => {
          if (monitorsUsedPerTeam.dates.indexOf(date._id) === -1) {//add it if it isn't already there
            monitorsUsedPerTeam.dates.push(date._id);
          }

            for (let i = 0; i < 24; i++) {
              if (date._id === dateString)
                for (let session of date.sessions) {

                  if (checkTime(i, 0, session.startTime, session.endTime)) {
                    onlineToday[i]++;

                    break;

                  }
                }
              let monitorsChecked = [];//make sure we don't recount a specific type.
              for (let session of date.sessions) {
                for (let monitorSession of session.monitorsUsed) {
                  if (checkTime(i, 0, monitorSession.startTime, monitorSession.endTime) && monitorsChecked.indexOf(monitorSession.monitor.type) === -1) {
                    if (date._id === dateString)
                      monitorsUsedToday[monitorSession.monitor.type][i] += 1;
                    let monitorsUsedThisTeam = monitorsUsedPerTeam[team._id];
                    if (!monitorsUsedThisTeam[date._id]) {
                      monitorsUsedThisTeam[date._id] = Array(24).fill(0)
                    }
                    monitorsUsedThisTeam[date._id][i] += 1;
                    monitorsChecked.push(monitorSession.monitor.type);


                  }
                }
              }

            }


        })

      })
    });
    for(let team in monitorsUsedPerTeam){
      if (!monitorsUsedPerTeam.hasOwnProperty(team) || team === 'dates')
        continue;
      for(let date in monitorsUsedPerTeam[team]){
        if(!monitorsUsedPerTeam[team].hasOwnProperty(date))
          continue;
        monitorsUsedPerTeam[team][date]={byHour:monitorsUsedPerTeam[team][date],max: Math.max(...monitorsUsedPerTeam[team][date])};
      }

    }
    console.log(monitorsUsedPerTeam);
    //convert monitors used to percentages
    let monitorsUsedPercentages = JSON.parse(JSON.stringify(monitorsUsedToday));
    for (let type in monitorsUsedPercentages) {
      if (!monitorsUsedPercentages.hasOwnProperty(type))
        continue;
      for (let i = 0; i < monitorsUsedPercentages[type].length; i++) {
        monitorsUsedPercentages[type][i] = (monitorsUsedPercentages[type][i] / data.totalMonitors[type] * 100).toFixed(1);
      }

    }
    //set chart data
    let employeesOnlineCardData = {...this.state.employeesOnlineCardData},
      freeLaptopCardData = {...this.state.freeLaptopCardData},
      freeProjectorsCardData = {...this.state.freeProjectorsCardData},
      freeDeskMonitorsCardData = {...this.state.freeDeskMonitorsCardData};
    employeesOnlineCardData.datasets[0].data = onlineToday;
    freeLaptopCardData.datasets[0].data = monitorsUsedPercentages[MONITOR_TYPE.LAPTOP];
    freeDeskMonitorsCardData.datasets[0].data = monitorsUsedPercentages[MONITOR_TYPE.DESK];
    freeProjectorsCardData.datasets[0].data = monitorsUsedPercentages[MONITOR_TYPE.PROJECTOR];



    let selectedDates = monitorsUsedPerTeam.dates.map((date, index) => {
      if (index > 10)//don't select more than 10 dates
        return undefined;
      let splitted = date.split('-');
      return new Date(parseInt(splitted[0]), parseInt(splitted[1]), parseInt(splitted[2]));
    });
    this.setState({
      monitorIndex: data.monitorIndex,
      teamIndex: data.teamIndex,
      date: selectedDates,
      totalMonitors: data.totalMonitors,
      monitorsUsed: monitorsUsedToday,
      monitorsUsedPerTeam,
      employeesOnlineCardData,
      freeLaptopCardData,
      freeProjectorsCardData,
      freeDeskMonitorsCardData
    });
    this.dateChange(selectedDates);//updates main chart


    console.log(raw.data, data.totalMonitors, monitorsUsedToday);
    console.timeEnd('processData');

  }


  render() {
    let hour = new Date().getHours();
    let getFree = (type) => {
      return this.state.monitorsUsed && this.state.monitorsUsed[type] ? this.state.totalMonitors[type] - this.state.monitorsUsed[type][hour] : null;

    };
    let dateStyle={
      width: '40%'
    };
    return (
      <div className="animated fadeIn">
        {/*Cards at top*/}
        <Row>

          <Col xs="12" sm="6" lg="3">
            <DashboardCard className="text-white card-1-bg" title="Laptops not in use this Hour"
                           content={getFree(MONITOR_TYPE.LAPTOP)}>
              <div className="chart-wrapper mx-3" style={{height: '70px'}}>
                <Line data={this.state.freeLaptopCardData} options={freeLaptopCardOpts} height={70}/>
              </div>

            </DashboardCard>
          </Col>

          <Col xs="12" sm="6" lg="3">
            <DashboardCard className="text-white card-2-bg" title="Desk Monitors not in use this Hour"
                           content={getFree(MONITOR_TYPE.DESK)}>

              <div className="chart-wrapper mx-3" style={{height: '70px'}}>
                <Line data={this.state.freeDeskMonitorsCardData} options={freeDeskMonitorsCardOpts} height={70}/>
              </div>
            </DashboardCard>

          </Col>

          <Col xs="12" sm="6" lg="3">
            <DashboardCard className="text-white card-3-bg" title="Display Screens not in use this Hour"
                           content={getFree(MONITOR_TYPE.PROJECTOR)}>
              <div className="chart-wrapper" style={{height: '70px'}}>
                <Line data={this.state.freeProjectorsCardData} options={freeProjectorsCardOpts} height={70}/>
              </div>
            </DashboardCard>
          </Col>

          <Col xs="12" sm="6" lg="3">
            <DashboardCard className="text-white card-4-bg" title="Employees Currently Online"
                           request="employees/online">
              <div className="chart-wrapper mx-3" style={{height: '70px'}}>
                <Bar data={this.state.employeesOnlineCardData} options={employeesOnlineCardOpts} height={70}/>
              </div>
            </DashboardCard>
          </Col>
        </Row>
        <Row>
          <Col>
            <Card>
              <CardBody>
                <Row>
                  <Col sm="5">
                    <CardTitle className="mb-0">Total Monitor Utilization per Team</CardTitle>
                    <div className="small text-muted"></div>
                  </Col>
                  <Col sm="7" className="d-none d-sm-inline-block">
                    <Button color="primary" className="float-right"><i className="icon-cloud-download"></i></Button>
                    <ButtonToolbar className="float-right" aria-label="Toolbar with button groups">
                      <ButtonGroup className="mr-3" aria-label="First group">
                        <Button color="outline-secondary" onClick={() => this.onRadioBtnClick(1)}
                                active={this.state.radioSelected === 1}>Day</Button>
                        <Button color="outline-secondary" onClick={() => this.onRadioBtnClick(2)}
                                active={this.state.radioSelected === 2}>Dates</Button>
                      </ButtonGroup>

                    </ButtonToolbar>
                    <Flatpickr
                      className="form-control"
                      style={dateStyle}
                      value={this.state.date}
                      options={{
                        mode: this.state.radioSelected === 1 ? "multiple" : "range",
                        dateFormat: "Y-m-d",
                        disable: [
                          (date) => {
                            if (!this.state.monitorsUsedPerTeam)
                              return true;
                            let dateString = createDateString(date);
                            // return true to disable
                            return this.state.monitorsUsedPerTeam.dates.indexOf(dateString) === -1;

                          }
                        ]
                      }}
                      onChange={date => { this.dateChange(date) }} />
                  </Col>
                </Row>
                <div className="chart-wrapper" style={{height: 300 + 'px', marginTop: 40 + 'px'}}>
                  <Line data={this.state.mainChartData} options={mainChartOpts} height={300}/>
                </div>
              </CardBody>
              <CardFooter>
                <Row className="text-center">
                  <Col sm={12} md className="mb-sm-2 mb-0">
                    <div className="text-muted">Team 1</div>
                    <strong>29.703 Users (40%)</strong>
                    <Progress className="progress-xs mt-2" color="success" value="40"/>
                  </Col>
                  <Col sm={12} md className="mb-sm-2 mb-0 d-md-down-none">
                    <div className="text-muted">Team 2</div>
                    <strong>24.093 Users (20%)</strong>
                    <Progress className="progress-xs mt-2" color="info" value="20"/>
                  </Col>
                  <Col sm={12} md className="mb-sm-2 mb-0">
                    <div className="text-muted">Team 3</div>
                    <strong>78.706 Views (60%)</strong>
                    <Progress className="progress-xs mt-2" color="warning" value="60"/>
                  </Col>
                  <Col sm={12} md className="mb-sm-2 mb-0">
                    <div className="text-muted">Team 4</div>
                    <strong>22.123 Usekrs (80%)</strong>
                    <Progress className="progress-xs mt-2" color="danger" value="80"/>
                  </Col>
                  <Col sm={12} md className="mb-sm-2 mb-0 d-md-down-none">
                    <div className="text-muted">Team 4</div>
                    <strong>Average Rate (40.15%)</strong>
                    <Progress className="progress-xs mt-2" color="primary" value="40"/>
                  </Col>
                </Row>
              </CardFooter>
            </Card>
          </Col>
        </Row>



      </div>
    );
  }

}


export default Dashboard;

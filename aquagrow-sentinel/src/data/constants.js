export const DBK='aqs_db_v1',SK='aqs_session_v1';
export const M={moisture:{n:'Soil moisture',u:'%'},temp:{n:'Water temp',u:'°C'},ph:{n:'pH',u:''},turb:{n:'Turbidity',u:' NTU'}};
export const KIND={garden:['moisture'],pond:['temp','ph','turb']};
export const DEFTH={moisture:{wl:40,cl:25},temp:{wh:32,ch:35},ph:{wl:6.5,cl:6,wh:8.5,ch:9},turb:{wh:50,ch:100}};
export const USERS=[
 {id:'u1',name:'Maria Santos',email:'owner@aquagrow.ph',pw:'Owner123',role:'Owner',phone:'+63 917 000 0001',farms:[]},
 {id:'u2',name:'Juan Dela Cruz',email:'staff@aquagrow.ph',pw:'Staff123',role:'Staff',phone:'+63 917 000 0002',farms:['f1','f2']},
 {id:'u4',name:'Pedro Lim',email:'staff2@aquagrow.ph',pw:'Staff123',role:'Staff',phone:'+63 917 000 0004',farms:['f2']},
 {id:'u3',name:'Ana Reyes',email:'viewer@aquagrow.ph',pw:'Viewer123',role:'Viewer',phone:'+63 917 000 0003',farms:['f1']}];
export const NAV=[
 ['dash','📊','Dashboard',['Owner','Staff','Viewer']],
 ['farms','🌱','Farm Management',['Owner','Staff','Viewer']],
 ['dev','📡','Devices & Sensors',['Owner','Staff','Viewer']],
 ['alerts','🚨','Alerts',['Owner','Staff','Viewer']],
 ['irr','💧','Irrigation',['Owner','Staff']],
 ['hist','🗂️','History & Logs',['Owner','Staff','Viewer']],
 ['rep','📈','Reports',['Owner','Staff','Viewer']],
 ['notif','🔔','Notifications',['Owner','Staff','Viewer']],
 ['users','👥','Users & Access',['Owner']],
 ['set','⚙️','Settings',['Owner','Staff']],
 ['rel','🛡️','System Health',['Owner','Staff']],
 ['acct','👤','My Account',['Owner','Staff','Viewer']]];



export const DEFV={moisture:50,temp:28,ph:7,turb:20};

export const LATEST_FW='1.2.0';
export const DEFB='ESP32 DevKit V1 (38-pin)';
/** Usable GPIOs per board. Analog inputs use ADC1 only (ADC2 conflicts with Wi-Fi). */
export const BOARDS={
  'ESP32 DevKit V1 (30-pin)':{analog:[32,33,34,35],digital:[4,13,14,16,17,18,19,21,22,23,25,26,27]},
  'ESP32 DevKit V1 (38-pin)':{analog:[32,33,34,35,36,39],digital:[4,5,13,14,16,17,18,19,21,22,23,25,26,27]},
};
export const RESERVED={0:'Boot mode',1:'UART TX',2:'Boot / onboard LED',3:'UART RX',6:'Flash',7:'Flash',8:'Flash',9:'Flash',10:'Flash',11:'Flash',12:'Boot voltage',15:'Boot log'};
export const STYPES={
  moisture:{name:'Capacitive soil moisture sensor',pin:'analog'},
  temp:{name:'DS18B20 waterproof temperature sensor',pin:'digital'},
  ph:{name:'Analog pH probe module',pin:'analog'},
  turb:{name:'Analog turbidity sensor',pin:'analog'},
};

/** Demo timing: unacknowledged critical alerts escalate to the owner after 2 minutes. */
export const ESC_MS=2*60000;

export const APP_VERSION='0.7.0';
export const PERMS=[['farms','Add and edit gardens and ponds'],['devices','Register devices and sensors, record maintenance'],['pumps','Control irrigation pumps'],['alerts','Acknowledge, assign and resolve alerts'],['thresholds','Change sensor thresholds'],['export','Export reports and data']];
export const ROLE_INFO={Owner:'Full access to the whole system, users and settings.',Staff:'Works on the farms they are assigned to: monitoring, alerts, irrigation and maintenance, within the permissions given.',Viewer:'Read-only access to monitoring data and reports for assigned farms.'};

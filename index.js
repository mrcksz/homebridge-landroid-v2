"use strict";
/*
 * Landroid Worx plugin for HomeBridge
 *
 * CloudConnector and all files in the lib folder are copied from
 * https://github.com/iobroker-community-adapters/ioBroker.worx
 *
 */
const fs = require("fs");
const path_ad = require("path");
var Accessory, Service, Characteristic, UUIDGen, STORAGE_PATH;
var CloudConnector = require('./CloudConnector');
var LandroidDataset = require('./LandroidDataset');

function LandroidPlatform(log, config, api) {
  this.config = config;
  this.log = log;
  this.partymode = config.partymode || false;
  this.debug = config.debug || false;
  this.mowdata = config.mowdata || false;
  this.cloud = config.cloud || "worx";
  this.accessories = [];
  this.staleAccessories = [];
  this.cloudMowers = [];

  if(!config.email || !config.pwd){
    this.log("WARNING: No account configured, please set email and password of your Worx account in config.json!");
    return;
  }

  const self = this;
  this.api = api;

  // Listen to event "didFinishLaunching", this means homebridge already finished loading cached accessories.
  // Platform Plugin should only register new accessory that doesn't exist in homebridge after this event.
  // Or start discover new accessories.
  this.api.on('didFinishLaunching', async function () {
    self.log('DidFinishLaunching');
    if(self.config.reload){
      self.log('**** WARNING: Landroid plugin is in reload mode, mowers will be recreated each boot ****');
      self.accessories.forEach(accessory => {
        self.log('Removing Landroid ' + accessory.accessory.displayName + ' from HomeKit');
        self.api.unregisterPlatformAccessories('homebridge-landroid-v2', 'Landroid', [accessory.accessory]);
      });
      self.accessories = [];
    }
    self.landroidCloud = CloudConnector();
    let persisted_states = self.landroidCloud.loadLandroidObjectData(STORAGE_PATH);
    for(var myname in persisted_states) {
      self.createUpdate(myname, persisted_states[myname]);
    }

    self.accessories.forEach(accessory=>{
      accessory.landroidCloud = self.landroidCloud;
    });

    // Remove any leftover standalone Edge Cut accessories from earlier dev builds
    if(self.staleAccessories.length){
      self.log('Removing ' + self.staleAccessories.length + ' obsolete accessory/accessories from HomeKit');
      self.api.unregisterPlatformAccessories('homebridge-landroid-v2', 'Landroid', self.staleAccessories);
      self.staleAccessories = [];
    }
    self.landroidCloud.config = {
      "mail": config.email,
      "password": config.pwd,
      "server": config.cloud || "worx"
    }
    self.landroidCloud.log = new LandroidLogger(log);
    self.landroidCloud.log.isDebug = self.debug;
    self.landroidCloud.setState = function(objectname,object) {
      try {
        self.landroidCloud.states[objectname] = object;
        self.landroidCloud.saveLandroidObjectData();
        if(objectname == "info.connection" && object == true){
          self.removeTimeout = setTimeout(self.clearOldMowers.bind(self), 60000);
        } else if(objectname.includes(".mower.")){
          let serial = objectname.substring(0, objectname.indexOf("."));
          let item = objectname.split('.').pop();

          if(object && (object.val !== null || object.val !== undefined)) {
            self.landroidUpdate(serial, item, object.val);
          }
        }
      } catch(err) {
        self.log('Error handling state update for ' + objectname + ': ' + (err && err.stack ? err.stack : err));
      }
    };
    self.landroidCloud.setObjectNotExists = async function(objectname, object) {
      try {
        if(!objectname instanceof String) return;
        if(!object.common.name instanceof String) return;
        if(!self.landroidCloud.objects[objectname]) {
          self.landroidCloud.objects[objectname] = {};
        }
        if(!objectname.includes(".") && object.common.name != "[object Object]"){
          self.landroidFound(object.common.name, objectname);
        }
      } catch(err) {
        self.log('Error handling object update for ' + objectname + ': ' + (err && err.stack ? err.stack : err));
      }
    };
    try {
      await self.landroidCloud.onReady();
    } catch(err) {
      self.log('Error while connecting to the Worx cloud: ' + (err && err.stack ? err.stack : err));
    }
  });
}

LandroidPlatform.prototype.clearOldMowers = function() {
  const self = this;
  for(let idx = this.accessories.length - 1; idx >= 0; idx--){
    if(!self.cloudMowers.includes(this.accessories[idx].serial)){
      self.api.unregisterPlatformAccessories('homebridge-landroid-v2', 'Landroid', [this.accessories[idx].accessory]);
      this.accessories.splice(idx, 1);
    }
  }
}

// Function invoked when homebridge tries to restore cached accessory.
LandroidPlatform.prototype.configureAccessory = function(accessory) {
  if (!this.config) { // happens if plugin is disabled and still active accessories
    return;
  }
  accessory.reachable = false;
  if(accessory.context && accessory.context.type === 'edgecut'){
    // Standalone Edge Cut accessory from an earlier dev build - schedule for removal
    this.staleAccessories.push(accessory);
    return;
  }
  this.log('Restoring Landroid ' + accessory.displayName + ' from HomeKit');
  this.accessories.push(new LandroidAccessory(this, null, null, accessory));
}

// Handler will be invoked when user try to config your plugin.
// Callback can be cached and invoke when necessary.
LandroidPlatform.prototype.configurationRequestHandler = function(context, request, callback) {
  callback(null);
}

LandroidPlatform.prototype.landroidFound = function(name, serial) {
  if(this.debug) {
    this.log("[DEBUG] MOWER: " + name + " (" + serial + ")");
  }else {
    this.log("Found Landroid in Worx Cloud with name: " + name);
  }
  if(this.mowdata) {
    this.log("Mowing data logging enabled for Landroid " + name);
  }
  if(!this.cloudMowers.includes(serial)){
    this.cloudMowers.push(serial);
  }
  for(var i = 0; i<this.accessories.length; i++){
    const accessory = this.accessories[i];
    if(accessory.serial == serial){
      //already have this one
      accessory.accessory.reachable = true;
      //this.landroidUpdate(mower, data);
      return;
    }
  }
  // don't have this one, add it
  const newMower = new LandroidAccessory(this, name, serial);
  this.accessories.push(newMower);
  this.log("Adding Landroid " + name + " to HomeKit");
  this.api.registerPlatformAccessories('homebridge-landroid-v2', 'Landroid', [newMower.accessory]);
  //this.landroidUpdate(mower,data);
}

LandroidPlatform.prototype.createUpdate = function(objectname, object) {
  if(objectname.includes(".mower.")){
    let serial = objectname.substring(0, objectname.indexOf("."));
    let item = objectname.split('.').pop();
    if(object && (object.val !== null || object.val !== undefined)) {
      this.landroidUpdate(serial, item, object.val);
    }
  }
}

LandroidPlatform.prototype.landroidUpdate = function(serial, item, data) {
    if(this.debug) {
      this.log("[DEBUG] DATA: " + item + ": " + JSON.stringify(data));
    }
    this.accessories.forEach(accessory=>{
        accessory.landroidUpdate(serial, item, data, this.mowdata);
    });
}

//TODO: add other constructor
function LandroidAccessory(platform, name, serial, accessory) {
    this.landroidCloud = platform.landroidCloud;
    this.log = platform.log;
    this.config = platform.config;

    if (accessory) {
      this.accessory = accessory;
    } else {
      // new accessory object
      var uuid = UUIDGen.generate(serial);
      //this.log('Creating new accessory for ' + name + ' (' + serial + ')');
      this.accessory = new Accessory("Landroid " + name, uuid);
      this.accessory.context.name = name;
      this.accessory.context.serial = serial;

      this.accessory.addService(new Service.Switch("Landroid " + name));
      this.accessory.addService(new Service.Battery());
      this.accessory.addService(new Service.ContactSensor("Landroid " + name + " Problem", "ErrorSensor"));
    }

    this.name = this.accessory.context.name;
    this.serial = this.accessory.context.serial;

    // Reconcile optional services on every startup so enabling/disabling them in
    // the config also works for accessories restored from the HomeKit cache
    // (not just newly created ones).
    this.reconcileOptionalService(Service.LeakSensor, "Landroid " + this.name + " Rain", null, !!this.config.rainsensor);
    this.reconcileOptionalService(Service.ContactSensor, "Landroid " + this.name + " Home", "HomeSensor", !!this.config.homesensor);
    this.reconcileOptionalService(Service.Switch, "Landroid " + this.name + " PartyMode", "PartySwitch", !!this.config.partymode);
    // Remove the old long-named Edge Cut sub-switch from earlier dev builds, then
    // add the Edge Cut trigger as a short-named service on the mower accessory.
    this.reconcileOptionalService(Service.Switch, "Landroid " + this.name + " Edge Cut", "EdgeSwitch", false);
    const edgeService = this.reconcileOptionalService(Service.Switch, "Edge Cut", "EdgeCut", !!this.config.edgecut);
    if(edgeService && !edgeService.testCharacteristic(Characteristic.ConfiguredName)){
      // set a friendly name once on creation; don't overwrite a later user rename
      edgeService.addOptionalCharacteristic(Characteristic.ConfiguredName);
      edgeService.setCharacteristic(Characteristic.ConfiguredName, "Edge Cut");
    }

    this.dataset = {};
    this.dataset.batteryState = 0;
    this.dataset.batteryCharging = false;
    this.dataset.statusCode = 0;
    this.dataset.errorCode = 0;

    if(this.accessory.getService("Landroid " + name)){
      this.accessory.getService("Landroid " + name).getCharacteristic(Characteristic.On).on('get', this.getOn.bind(this));
      this.accessory.getService("Landroid " + name).getCharacteristic(Characteristic.On).on('set', this.setOn.bind(this));
    } else{
      this.log("Fallback for On/Off switch");
      this.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).on('get', this.getOn.bind(this));
      this.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).on('set', this.setOn.bind(this));
    }

    this.accessory.getService(Service.Battery).getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
    this.accessory.getService(Service.Battery).getCharacteristic(Characteristic.StatusLowBattery).on('get', this.getStatusLowBattery.bind(this));
    this.accessory.getService(Service.Battery).getCharacteristic(Characteristic.ChargingState).on('get', this.getChargingState.bind(this));

    if(this.accessory.getService("ErrorSensor")){
      this.accessory.getService("ErrorSensor").getCharacteristic(Characteristic.ContactSensorState).on('get', this.getContactSensorStateError.bind(this));
    } else{
      this.accessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).on('get', this.getContactSensorStateError.bind(this));
    }
  
    this.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, 'Worx')
      .setCharacteristic(Characteristic.Model, 'Landroid')
      .setCharacteristic(Characteristic.SerialNumber, this.serial);

    if(this.config.rainsensor && this.accessory.getService(Service.LeakSensor)) this.accessory.getService(Service.LeakSensor).on('get', this.getLeak.bind(this));
    if(this.config.homesensor && this.accessory.getService("HomeSensor")) this.accessory.getService("HomeSensor").getCharacteristic(Characteristic.ContactSensorState).on('get', this.getContactSensorStateHome.bind(this));
    if(this.config.partymode && this.accessory.getService("PartySwitch")) {
      this.accessory.getService("PartySwitch").getCharacteristic(Characteristic.On).on('get', this.getPartyMode.bind(this));
      this.accessory.getService("PartySwitch").getCharacteristic(Characteristic.On).on('set', this.setPartyMode.bind(this));
    } else if(this.config.partymode) {
      this.log("Party switch not found");
    }
    if(this.config.edgecut && this.accessory.getService("EdgeCut")) {
      this.accessory.getService("EdgeCut").getCharacteristic(Characteristic.On).on('get', this.getEdgeCut.bind(this));
      this.accessory.getService("EdgeCut").getCharacteristic(Characteristic.On).on('set', this.setEdgeCut.bind(this));
    } else if(this.config.edgecut) {
      this.log("Edge Cut switch not found");
    }

    // Mark the mower on/off switch as the primary service so HomeKit keeps the
    // extra switches (PartyMode, Edge Cut) grouped under this one accessory.
    const mainSwitch = this.accessory.getService("Landroid " + this.name) || this.accessory.getService(Service.Switch);
    if(mainSwitch && mainSwitch.setPrimaryService) mainSwitch.setPrimaryService(true);
}

// Add the optional service if it should exist and doesn't yet, or remove it if
// it exists but is now disabled. Works for both new and cache-restored accessories.
LandroidAccessory.prototype.reconcileOptionalService = function(ServiceType, displayName, subtype, enabled) {
  const key = subtype || displayName;
  let service = this.accessory.getService(key);
  if(enabled && !service) {
    this.log("Adding service '" + displayName + "' to Landroid " + this.name);
    service = subtype ? new ServiceType(displayName, subtype) : new ServiceType(displayName);
    this.accessory.addService(service);
  } else if(!enabled && service) {
    this.log("Removing service '" + displayName + "' from Landroid " + this.name);
    this.accessory.removeService(service);
    service = undefined;
  }
  return service;
}

LandroidAccessory.prototype.landroidUpdate = function(serial, item, data, mowdata) {
  var totalTime, totalBladeTime, totalDistance;

  if(serial !== this.serial) return;

  if(data != null && data != undefined){
    let oldDataset = this.dataset;
    if(item == "status") {
      item = "statusCode";
    } else if(item == "error") {
      item = "errorCode";
    }
    this.dataset[item] = data;
    // this.log("landroidUpdate ran with RSSI " + this.dataset.wifiQuality + ", battery temperature " + this.dataset.batteryTemperature);
    if(mowdata){
      if(oldDataset.totalTime == null || oldDataset.totalTime == undefined){
         // Initialise mowing data
        this.saveTime = Number(this.dataset.totalTime);
        totalTime = this.saveTime / 60;
        totalTime = totalTime.toFixed(2);
        this.saveBladeTime = Number(this.dataset.totalBladeTime);
        totalBladeTime = this.saveBladeTime / 60;
        totalBladeTime = totalBladeTime.toFixed(2);
        this.saveDistance = Number(this.dataset.totalDistance);
        this.log("Landroid " + this.name + " hours worked so far: " + totalTime 
          + ", hours mowed so far: " + totalBladeTime 
          + ", distance moved so far: " + String(this.saveDistance / 1000) + "km");
      }
    }
    if(this.dataset.batteryState != oldDataset.batteryState){
    //  this.log("Landroid " + this.name + " battery level changed to " + this.dataset.batteryState);
      this.accessory.getService(Service.Battery).getCharacteristic(Characteristic.BatteryLevel).updateValue(this.dataset.batteryState);
    }
    if(this.dataset.partyModus != oldDataset.partyModus){
      if(this.accessory.getService("PartySwitch")){
       this.accessory.getService("PartySwitch").getCharacteristic(Characteristic.On).updateValue(this.dataset.partyModus == true);
      }
    }
    if(this.dataset.batteryCharging != oldDataset.batteryCharging){
      this.log("Landroid " + this.name + " charging status changed to " + this.dataset.batteryCharging 
        + ", battery level " + this.dataset.batteryState);
      this.accessory.getService(Service.Battery).getCharacteristic(Characteristic.ChargingState).updateValue(this.dataset.batteryCharging?
        Characteristic.ChargingState.CHARGING:Characteristic.ChargingState.NOT_CHARGING);
    }
    if(this.dataset.statusCode != oldDataset.statusCode){
      this.log("Landroid " + this.name + " status changed to " + this.dataset.statusCode + " (" + this.dataset.statusDescription + ")" 
        + ", battery level " + this.dataset.batteryState);
      if(isOn(this.dataset.statusCode)){
        this.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(true);
        if(this.config.homesensor && this.accessory.getService("HomeSensor")) this.accessory.getService("HomeSensor").getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
      }else{
        this.accessory.getService(Service.Switch).getCharacteristic(Characteristic.On).updateValue(false);
      }
      if(this.dataset.statusCode == 1 && oldDataset.totalTime != null && oldDataset.totalTime != undefined && mowdata) {
        // Landroid has just arrived home so show how much it's worked since last leaving (or last restarting Homebridge)
        totalTime = Number(this.dataset.totalTime);
        totalBladeTime = Number(this.dataset.totalBladeTime);
        totalDistance = Number(this.dataset.totalDistance);
        this.log("Landroid " + this.name + " new minutes worked: " + String(totalTime - this.saveTime)
          + ", new minutes mowed: " + String(totalBladeTime - this.saveBladeTime)
          + ", new distance moved: " + String(totalDistance - this.saveDistance) + "m");
        this.saveTime = totalTime;
        this.saveBladeTime = totalBladeTime;
        this.saveDistance = totalDistance;
      }
      if(this.dataset.statusCode == 1 && this.config.homesensor && this.accessory.getService("HomeSensor")) this.accessory.getService("HomeSensor").getCharacteristic(Characteristic.ContactSensorState).updateValue(Characteristic.ContactSensorState.CONTACT_DETECTED);
    }
    if(this.dataset.errorCode != oldDataset.errorCode){
      this.log("Landroid " + this.name + " error code changed to " + this.dataset.errorCode + " (" + this.dataset.errorDescription + ")" 
        + ", battery level " + this.dataset.batteryState);
      if(this.accessory.getService("ErrorSensor")){
        this.accessory.getService("ErrorSensor").getCharacteristic(Characteristic.ContactSensorState).updateValue(isError(this.dataset.errorCode)?
        Characteristic.ContactSensorState.CONTACT_NOT_DETECTED:Characteristic.ContactSensorState.CONTACT_DETECTED);
      } else{
        this.accessory.getService(Service.ContactSensor).getCharacteristic(Characteristic.ContactSensorState).updateValue(isError(this.dataset.errorCode)?
        Characteristic.ContactSensorState.CONTACT_NOT_DETECTED:Characteristic.ContactSensorState.CONTACT_DETECTED);
      }    
      if(this.config.rainsensor && this.accessory.getService(Service.LeakSensor)) this.accessory.getService(Service.LeakSensor).getCharacteristic(Characteristic.LeakDetected).updateValue(this.dataset.errorCode == 5);
    }
  }
}

LandroidAccessory.prototype.getContactSensorStateError = function(callback) {
  callback(null,  isError(this.dataset.errorCode)?Characteristic.ContactSensorState.CONTACT_NOT_DETECTED:Characteristic.ContactSensorState.CONTACT_DETECTED);
}

LandroidAccessory.prototype.getContactSensorStateHome = function(callback) {
  callback(null,  this.dataset.statusCode == 1?Characteristic.ContactSensorState.CONTACT_DETECTED:Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
}

LandroidAccessory.prototype.getBatteryLevel = function(callback) {
  callback(null, this.dataset.batteryState);
}

LandroidAccessory.prototype.getChargingState = function(callback) {
  callback(null, this.dataset.batteryCharging?Characteristic.ChargingState.CHARGING:Characteristic.ChargingState.NOT_CHARGING);
}

LandroidAccessory.prototype.getStatusLowBattery = function(callback) {
  callback(null, this.dataset.errorCode == 12?Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW:Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
}

LandroidAccessory.prototype.getOn = function(callback) {
  if(isOn(this.dataset.statusCode)){
    callback(null, true);
  }else{
    callback(null, false);
  }
}

LandroidAccessory.prototype.getLeak = function(callback) {
  if(this.dataset.statusCode == 5){
    callback(null, true);
  }else{
    callback(null, false);
  }
}

LandroidAccessory.prototype.setOn = function(state, callback) {
  if(state){
    this.sendMessage(1);
  }else{
    this.sendMessage(3);
  }
  callback(null);
}

LandroidAccessory.prototype.getPartyMode = function(callback) {
  if(this.dataset.partyModus) {
    callback(null, true);
  }else{
    callback(null, false);
  }
}

LandroidAccessory.prototype.setPartyMode = function(state, callback) {
  if(!this.serial){
    this.log("Error: Mower has not been configured yet.");
  }
  let outMsg = "";
  if (state) {
    outMsg = '{"sc":{ "m":2, "distm": 0}}';
  } else{
    outMsg = '{"sc":{ "m":1, "distm": 0}}';
  }
  this.log("Sending to Landroid " + this.name + ": [" + outMsg + "] ("+this.serial+")");
  this.landroidCloud.sendMessage(outMsg, this.serial);
  callback(null);
}

// The Edge Cut switch is a momentary trigger button: it always reads as off and
// resets itself shortly after being switched on, so it works regardless of
// whether the mower is currently mowing or at home.
LandroidAccessory.prototype.getEdgeCut = function(callback) {
  callback(null, false);
}

LandroidAccessory.prototype.setEdgeCut = function(state, callback) {
  if(state) {
    if(!this.serial){
      this.log("Error: Mower has not been configured yet.");
    } else {
      // One-time schedule that only cuts the border/edge (bc=1) with no extra mowing (wtm=0)
      let outMsg = '{"sc":{"ots":{"bc":1,"wtm":0}}}';
      this.log("Sending to Landroid " + this.name + ": [" + outMsg + "] ("+this.serial+")");
      this.landroidCloud.sendMessage(outMsg, this.serial);
    }
    const svc = this.accessory.getService("EdgeCut");
    if(svc) {
      setTimeout(function(){
        svc.getCharacteristic(Characteristic.On).updateValue(false);
      }, 1000);
    }
  }
  callback(null);
}

LandroidAccessory.prototype.sendMessage = function(cmd, params) {
  if(!this.serial){
    this.log("Error: Mower has not been configured yet.");
  }
  let message = {};
    if (cmd) {
        message["cmd"] = cmd;
    }
    if (params) {
        message = Object.assign(message, params);
    }
    let outMsg = JSON.stringify(message);
    this.log("Sending to Landroid " + this.name + ": [" + outMsg + "] ("+this.serial+")");
    this.landroidCloud.sendMessage(outMsg, this.serial);
}

function isOn(c){
  if(c == 2 || c == 3 || c == 4 || c == 6 || c == 7 || c == 32 || c == 33){
    return true;
  }else{
    return false;
  }
}

function isError(c){
  //no error and rain delay is "not an error"
  if(c == 0 || c == 5){
    return false;
  }else{
    return true;
  }
}

function LandroidLogger(log){
  let that = this;
  this.log = log;
  this.logMsg = function(msg){
    that.log(msg);
  }
  this.noLogMsg = function(msg){
    if(this.isDebug){
      that.log(msg);
    }
  }
  this.trace = this.noLogMsg;
  this.debug = this.noLogMsg;
  this.info = this.logMsg;
  this.warn = this.logMsg;
  this.error = this.logMsg;
  this.fatal = this.logMsg;
}

function updateStorage(newPath){
  var confPath = newPath + "/plugin-persist/homebridge-landroid-v2";
  if(!fs.existsSync(confPath)){
    fs.mkdirSync(confPath, {recursive: true});
  }
  return confPath;
}

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  STORAGE_PATH = updateStorage(homebridge.user.storagePath());
  homebridge.registerPlatform("homebridge-landroid-v2", "Landroid", LandroidPlatform, true);
}

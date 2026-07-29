# homebridge-landroid-v2

Maintained **v2 fork** of [`normen/homebridge-landroid`](https://github.com/normen/homebridge-landroid), which was discontinued in December 2023.

Homebridge plugin to control Worx Landroid (as well as Kress, Ferrex and Landxcape) lawn mowers through the Cloud, should support most mowers.

### Why this fork

The original plugin stopped working because Worx removed the `GET /api/v2/users/me` route from their cloud API (it is now `DELETE`-only). This caused the MQTT connection to crash with:

```
{"message":"The GET method is not supported for route api/v2/users/me. Supported methods: DELETE."}
awsMqtt: TypeError: Cannot set properties of undefined (setting 'mqtt_newendpoint')
Error mqtt connection!
```

This fork removes the obsolete `users/me` call and reads the required user id / MQTT endpoint directly from the `product-items` response (matching the current [`ioBroker.worx`](https://github.com/iobroker-community-adapters/ioBroker.worx) upstream), so login and MQTT work again.

## Features
 - Automatically fetches all mowers from Cloud
 - Start mower
 - Return mower to home
 - Mowing status (on / off)
 - Battery Status
 - Error status
 - Rain status
 - Home status

## Installation
1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-landroid-v2
   (or install the local folder during development: npm install -g .)
3. Set up homebridges config.json with your Worx account data

#### Example config
```
{
  "bridge": {
    "name": "Homebridge",
    "username": "CC:22:3D:E3:CE:30",
    "port": 51826,
    "pin": "031-45-154"
  },
  "platforms": [
    {
      "platform": "Landroid",
      "email": "my@email.com",
      "pwd": "my_password"
    }
  ]
}
```

#### Options
 - `email` eMail for your Worx account
 - `pwd` Password for your Worx account
 - `rainsensor` Adds an additional "Leak" sensor for rain detection
 - `homesensor` Adds an additional "Home" sensor for home detection
 - `partyswitch` Adds an additional "PartyMode" switch to temporarily disable the schedule
 - `reload` Clears all mowers in HomeKit and reloads them from the cloud, default `false`
 - `cloud` Sets the cloud to use, `worx`, `kress`, `ferrex` or `landxcape`, default `worx`
 - `debug` Enable additional debug log output, default `false`
 - `mowdata` Enable additional mowing data log output, default `false`

## Usage
 The mower will appear as a switch and a contact sensor in HomeKit.

#### On/Off Switch
The switch shows the current status and allows to control the mower. If the switch is off the mower is either on the home base or on its way to the home base. If it's on the mower is currently mowing. Turn the switch on to start the mowing cycle, turn it off to send the mower back home.

#### Contact Sensor
The contact sensor is used to display issues with the mower (trapped, outside wire etc.), when the contact sensor is "open" there is some issue that prevents the mower from continuing. Fix the issue to control the mower again.

#### Home Sensor
The home (contact) sensor is used to display if the mower is standing in home position, when the contact sensor is "open" the mower is currently not at home.

Note: If you update from Version <= 0.9.5 or enable the sensor after first setup then you need to reload all mowers. This also invalids your homekit automations which need to be reconfigured.

#### Battery Status
You can see the battery status in the settings of either the switch or contact sensor in the Home app and you can ask Siri about the battery status of your lawn mower.

## Development
If you want new features or improve the plugin, you're very welcome to do so. The projects `devDependencies` include homebridge and the `npm run test` command has been adapted so that you can run a test instance of homebridge during development. Alternatively you can use `npm run dev` if you have homebridge installed as a global package
#### Setup
- clone github repo
- `npm install` in the project folder
- create `.homebridge` folder in project root
- add `config.json` with appropriate content to `.homebridge` folder
- run `npm run test` to start the homebridge instance for testing
- alternatively run `npm run dev` to start homebridge if its installed as a global package

#### Notes
Most of the connector code is directly copied from [iobroker.worx](https://github.com/iobroker-community-adapters/ioBroker.worx), a helper script called 'sync-code' allows updating to the latest version of that code.

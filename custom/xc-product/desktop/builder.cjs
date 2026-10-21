const {dirname}=require('node:path');
module.exports={appId:'com.xuci.knowledge',productName:'胥瓷智库',directories:{app:'desktop',output:'release'},files:['main.cjs','package.json'],electronDist:dirname(require('electron')),npmRebuild:false,extraResources:[{from:'desktop/config.json',to:'config.json'}],win:{target:'nsis',signAndEditExecutable:false},mac:{target:'dmg'},linux:{target:'AppImage'}};

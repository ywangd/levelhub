# Platforms
`cordova platform add android ios`
* Note andriod requires Apache Ant to be installed.
* Need to config an Android AVD first become emulator can be ran. Follow this guide http://cordova.apache.org/docs/en/3.5.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide
* `npm install -g ios-sim` to before running ios simulator

# Plugins
`cordova plugin add https://git-wip-us.apache.org/repos/asf/cordova-plugin-console.git`

* On Windows, if error occurs relating to temporary directory (e.g. fatal:
  could not create work tree dir), create the required directory manually to
  fix it.

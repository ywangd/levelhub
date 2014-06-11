# Platforms
`cordova platform add android ios`
* Note andriod requires Apache Ant to be installed.
* Need to config an Android AVD first become emulator can be ran. Follow this guide http://cordova.apache.org/docs/en/3.5.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide
* `npm install -g ios-sim` to before running ios simulator

# Plugins
`cordova plugin add https://git-wip-us.apache.org/repos/asf/cordova-plugin-console.git`
`cordova plugin add org.apache.cordova.statusbar` 
    * To show ios statusbar above the webview via `StatusBar.overlaysWebView(false);`

* On Windows, if error occurs relating to temporary directory (e.g. fatal:
  could not create work tree dir), create the required directory manually to
  fix it.

# Debug
* Apache Ripple (not the chrome extension)
    * npm install -g ripple-emulator
    * `ripple emulate` in root directory
    * Note that this only works with Chrome as Firefox does not support WebSQL
        - To emulate the app without seeing ripple UI, do not append enable ripple at URL.
        - For any pop up message, just click cancel.

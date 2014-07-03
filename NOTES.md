# Platforms
`cordova platform add android ios`
* Note andriod requires Apache Ant to be installed.
* Need to config an Android AVD first become emulator can be ran. Follow this guide http://cordova.apache.org/docs/en/3.5.0/guide_platforms_android_index.md.html#Android%20Platform%20Guide
* `npm install -g ios-sim` to before running ios simulator

# Plugins
`cordova plugin add https://git-wip-us.apache.org/repos/asf/cordova-plugin-console.git`
`cordova plugin add org.apache.cordova.statusbar` 
    * To show ios statusbar above the webview via `StatusBar.overlaysWebView(false);`
`cordova plugin add org.apache.cordova.dialogs`
    * To use the device native alert, confirm etc. windows.

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
        - The Chrome Web Developer Tools can be used to debug the program

# Client-Server communication
* By default, Ajax cannot issue cross-domain requests
* We need to enable Cross Origin Resource Sharing (CORS) on both client and server to allow cross-domain Ajax
* Also turn off crsf protection in django to ease things up
## Server side
    * Need to add at least three headers: 
        - Access-Control-Allow-Origin
        - Access-Control-Allow-Methods
        - Access-Control-Allow-Credentials
            * This is needed for sending any cookies from server response back to the server, which in turns enables session management.
            * The cookies are saved under the domain of the remote server.
## Client side
    * jQuery ajax call 
        - Need to provide `xhrFields: {withCredentials: true}` and `crossDomain: true`

# ToDo
* Clear history stack when back to the home page to avoid memory hog?
* Make page DOMs properties of the app variable? So they are global to all methods?
* Clean up the code by reduce file (e.g. svg) sizes and remove testing codees.
* Global throttle on ajax
* ajax cache and invalidate caches

* Unify transitions to use slide everywhere?
* Weekly calendar to show lessons and provide links direct to the stamp management page
* Enroll, deroll, join, quit requests (approve and decline)
* News feed pull to refresh
* Clickable user name and lesson name on News tab.
* Revamp the setup tab to make it more comprehensive so setup is only one item of it. (It can probably be used to show weekly calendars?)
* Private messages?
* Support swiperight to go back for most of the pages except home, login, register and stamp.


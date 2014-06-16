# Database Tables

## Server Side
* Users
    * auto-id
    * **user-id**
    * fname
    * lname
    * desc
    * email
    * phone
    * address
    * url
    * ctime (creation timestamp)
    * data (any extra info store as json?)

* Classes
    * auto-id
    * **teacher-id**
    * **teach-id**
    * name
    * desc
    * is-active
    * ctime
    * data

* ClassRegs (Class student registrations)
    * auto-id
    * **teacher-id**
    * **teach-id**
    * **reg-id**
    * **user-id**
    * total
    * unused
    * is-active
    * ctime
    * data

* ClassRegLogs
    * auto-id
    * **teacher-id**
    * **teach-id**
    * **reg-id**
    * **user-id**
    * **log-id**
    * ctime
    * data

* ClassMsgs (messages to a class group)
    * **msg-id** (auto increment integer)
    * **teacher-id**
    * **teach-id**
    * **sender-id**
    * title
    * body
    * ctime
    * data

## Client Side
* Me (Key/Value table, so following items are rows instead of columns)
    * **user-id**
    * fname
    * lname
    * desc
    * email
    * phone
    * address
    * url
    * ctime
    * data

* Teaches
    * **teach-id** (auto increment integer)
    * name
    * desc
    * is-active
    * ctime
    * data

* TeachRegs
    * **teach-id** 
    * **reg-id** (auto increment integer. reg-id is needed because user-id may not be available)
    * **user-id** (this can be null, reg-id is always available)
    * user-fname
    * user-lname
    * total
    * unused
    * is-active
    * ctime
    * data

* TeachRegLogs
    * **reg-id**
    * **log-id** (auto increment integer)
    * use-time (null if unused)
    * ctime
    * data

* Learns (always refresh from server)
    * **teacher-id**
    * **teach-id**
    * teach-name
    * teach-desc
    * teacher-fname
    * teacher-lname
    * is-active
    * ctime

* ClassMsgs (always refresh from server)
    * **msg-id**
    * **teacher-id**
    * **teach-id**
    * **sender-id** (user-id of the message owner)
    * sender-fname
    * sender-lname
    * title
    * body
    * ctime
    * data


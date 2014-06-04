# Database Tables

## Server Side
* Users
    * ID
    * fname
    * lname
    * dname
    * desc
    * email
    * phone
    * address
    * url
    * ctime (creation timestamp)
    * data (any extra info store as json?)

* Classes
    * ID
    * teacher (FK using user ID)
    * name
    * desc
    * is_active
    * ctime
    * data

* ClassRegs (Class student registrations)
    * ID
    * class (FK using Classes ID)
    * user (FK using Users ID)
    * total
    * unused
    * is_active
    * ctime
    * data

* ClassRegLogs
    * ID 
    * reg (FK using ClassRegs ID)
    * ctime
    * data

* ClassMsgs (messages to a class group)
    * ID
    * class (FK using Classes ID) (the group to post messages)
    * user (FK using Users ID) (message author)
    * title
    * body
    * is_teacher_post (whether the message is posted by the teacher)
    * ctime
    * data

## Client Side
* Me (Key/Value table, so following items are rows instead of columns)
    * ID (this local ID is equal to server side user ID)
    * fname
    * lname
    * dname
    * desc
    * email
    * phone
    * address
    * url
    * ctime
    * data

* Teaches
    * ID
    * name
    * desc
    * is_active
    * ctime
    * data
    * SRV_ID (server side Classes ID)

* Students
    * ID
    * fname
    * lname
    * dname (display name)
    * data
    * SRV_ID (ID on server table)

* Learns (always refresh from server)
    * ID
    * SRV_class (server side class ID)
    * ctime
    * SRV_ID (server side ClassRegs ID)

* TeachRegs
    * ID
    * teach (local teach ID)
    * student (local student ID)
    * total
    * unused
    * ctime
    * data
    * SRV_ID (server side ClassRegs ID)

* TeachRegLogs
    * ID
    * reg (FK using local TeachRegs ID)
    * ctime
    * data
    * SRV_ID

* ClassMsgs 
    * ID
    * SRV_class (server side Classes ID)
    * SRV_user (server side Users ID)
    * SRV_user_dname
    * title
    * body
    * is_teacher_post
    * ctime
    * data
    * is_author (whether the local user is the author of the message)
    * SRV_ID


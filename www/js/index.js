(function ($) {
    var db;
    var stamps;
    var stampFirstIdx, stampLastIdx;

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).bind("deviceready", app.onDeviceReady)
            });
        },

        onDeviceReady: function () {
            db = window.openDatabase("levelhub", "1.0", "LevelHub", 65536);
            app.prepareDatabase();
            app.displayTeachRegs(1);
            
            // Handle Add Student button
            $("#teachRegs header a").click(function () {
                $.mobile.changePage($("#newStudent"), {
                    transition: "slidedown"
                });
            });
            
            // Handle Save button for new student page
            $("#newStudent footer a:eq(1)").click(function () {
                var fields = [];
                $.each($("#newStudentForm").serializeArray(), function (idx, field) {
                    fields.push(field.value);
                });
                if (fields.toString() == ",,") {
                    alert("More information required");
                } else {
                    fields.unshift($("#teachRegs").data("teach_id"));
                    db.transaction(
                        function (tx) {
                            tx.executeSql(
                                "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, user_dname) " +
                                "VALUES (?, ?, ?, ?);",
                                fields,
                                function () {
                                    $.mobile.changePage($("#teachRegs"), {
                                        transition: "slideup"
                                    });
                                    app.listStudentsForTeach(1);
                                },
                                app.dbError
                            );
                        });
                }
            });

            // Handle page transition for multi-page stamps
            $("#studentStamp-0, #studentStamp-1").find(".ui-content").on("swipeleft swiperight", function (event) {
                var currentPage = $(this).closest("section").attr("id");
                var targetPage;
                if (currentPage == "studentStamp-0") {
                    targetPage = $("#studentStamp-1");
                } else {
                    targetPage = $("#studentStamp-0");
                }
                var length = stamps.length;
                var eventName = event.type;
                if (eventName == "swipeleft") {
                    if (stampLastIdx < length) {
                        stampFirstIdx = stampLastIdx;
                        stampLastIdx = Math.min(stampFirstIdx + 9, length);
                        app.refreshStamps(targetPage);
                        $.mobile.changePage(targetPage, {
                            transition: "slide"
                        })
                    }
                } else {
                    if (stampFirstIdx >= 9) {
                        stampFirstIdx -= 9;
                        stampLastIdx = stampFirstIdx + 9;
                        app.refreshStamps(targetPage);
                        $.mobile.changePage(targetPage, {
                            transition: "slide",
                            reverse: true
                        })
                    }
                }
            });

            // Handle page transition to student stamp page
            $("#studentStamp-0, #studentStamp-1").on("pagebeforeshow", function(event, ui) {
                if (ui.prevPage.attr("id") == "teachRegs") {
                    var idx = window.localStorage.getItem("selectedStudentItemIndex");
                    var student_item = $("#teachRegs ul li a").eq(idx);
                    $("#studentStamp-0, #studentStamp-1").find("header h1").text(student_item.text());
                    var $this = $(this);
                    db.transaction(
                        function (tx) {
                            tx.executeSql(
                                "SELECT * FROM TeachRegLogs WHERE reg_id = ?",
                                [student_item.data("reg_id")],
                                function (tx, result) {
                                    var length = result.rows.length;
                                    var firstUnusedIdx = 0;
                                    for (var i = 0; i < length; i++) {
                                        if (!result.rows.item(i).use_time) {
                                            firstUnusedIdx = i;
                                            break;
                                        }
                                    }
                                    var currentPageIdx = Math.floor(firstUnusedIdx / 9);
                                    stampFirstIdx = currentPageIdx * 9;
                                    stampLastIdx = Math.min(stampFirstIdx + 9, length);
                                    stamps = [];
                                    for (var i=0; i < length; i++) {
                                        stamps.push(result.rows.item(i));
                                    }
                                    app.refreshStamps($this);
                                });
                        });
                }
            });
        },

        displayTeachRegs: function (teach_id) {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches WHERE id = ?",
                        [teach_id],
                        function (tx, result) {
                            var row = result.rows.item(0);
                            var teachRegs = $("#teachRegs");
                            teachRegs.data("teach_id", teach_id);
                            teachRegs.data("desc", row.desc);
                            teachRegs.find("header h1").text(row.name);
                            app.listStudentsForTeach(teach_id);
                        })
                }
            );
        },

        listStudentsForTeach: function (teach_id) {
            db.transaction(function (tx) {
                tx.executeSql(
                    "SELECT * FROM TeachRegs WHERE teach_id = ? ORDER BY id;",
                    [teach_id],
                    function (tx, result) {
                        var ul = $("#studentList");
                        ul.empty();
                        for (var i = 0; i < result.rows.length; i++) {
                            var row = result.rows.item(i);
                            var a = $("<a>", {
                                "href": "#studentStamp-0",
                                "data-transition": "slide",
                                text: row.user_fname + " " + row.user_lname
                            });
                            a.data("reg_id", row.id);
                            a.data("total", row.total);
                            a.data("unused", row.unused);
                            a.data("srv_id", row.srv_id);
                            a.click(function() {
                                window.localStorage.setItem("selectedStudentItemIndex",
                                    $(this).parent().prevAll().length);
                            });
                            ul.append($("<li>").append(a));
                        }
                        ul.listview('refresh');
                    },
                    app.dbError
                );
            });
        },

        refreshStamps: function (page) {
            var stampDoms = page.find(".stamp");
            var imgDoms = stampDoms.find("img");
            stampDoms.addClass("hidden");
            imgDoms.addClass("hidden");
            for (var i=stampFirstIdx; i < stampLastIdx; i++) {
                var row = stamps[i];
                stampDoms.eq(i-stampFirstIdx).removeClass("hidden");
                if (row.use_time != null) {
                    imgDoms.eq(i-stampFirstIdx).removeClass("hidden");
                }
            }
            stampDoms.off("tap").filter(":not(.hidden)").on("tap", function () {
                $(this).find("img").toggleClass("hidden");
                return false;
            });
            page.find(".pageCount").empty().append($("<div>", {
                text: (Math.floor(stampFirstIdx/9) + 1) + "/" + Math.ceil(stamps.length/9)
            }))
        },

        dbError: function (tx, err) {
            alert("DB Error " + err.message);
            console.log("DB error: " + err.message);
            return false;
        },

        prepareDatabase: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS Me (" +
                        "key VARCHAR PRIMARY KEY  NOT NULL , " +
                        "val TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Teaches (" +
                        "id INTEGER PRIMARY KEY  NOT NULL ," +
                        "name VARCHAR NOT NULL ," +
                        "desc TEXT," +
                        "is_active BOOL NOT NULL  DEFAULT 1 ," +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP ," +
                        "data TEXT," +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "teach_id INTEGER NOT NULL , " +
                        "user_fname VARCHAR , user_lname VARCHAR, user_dname VARCHAR, srv_user_id INTEGER, " +
                        "total INTEGER NOT NULL DEFAULT 0, " +
                        "unused INTEGER NOT NULL DEFAULT 0, " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegLogs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "reg_id INTEGER NOT NULL , " +
                        "use_time DATETIME, " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS ClassMsgs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "srv_class_id INTEGER NOT NULL , " +
                        "srv_user_id INTEGER NOT NULL , " +
                        "srv_user_dname VARCHAR, " +
                        "title VARCHAR NOT NULL , " +
                        "body TEXT, " +
                        "is_teacher_post BOOL NOT NULL DEFAULT 0, " +
                        "ctime DATETIME NOT NULL , " +
                        "data TEXT, " +
                        "is_author BOOL NOT NULL  DEFAULT 0, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Learns (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "srv_class_id INTEGER NOT NULL , " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "srv_id INTEGER);");

                },
                app.dbError,
                function () {
                    console.log("DB preparation completed.")
                });
        },

        nukeDatabase: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("DROP TABLE IF EXISTS TeachRegs;");
                    tx.executeSql("DROP TABLE IF EXISTS Students;");
                    tx.executeSql("DROP TABLE IF EXISTS Teaches;");
                    tx.executeSql("DROP TABLE IF EXISTS TeachRegLogs;");
                    tx.executeSql("DROP TABLE IF EXISTS ClassMsgs;");
                    tx.executeSql("DROP TABLE IF EXISTS Learns;");
                    tx.executeSql("DROP TABLE IF EXISTS Me;");
                }
            );
        },

        mockData: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("INSERT INTO Teaches (name, desc) VALUES ('Folk Guitar Basics', 'An introductory lesson for people who want to pick up guitar fast with no previous experience');");
                    tx.executeSql("INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) VALUES (1, 'Emma', 'Wang', 24, 24);");
                    tx.executeSql("INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) VALUES (1, 'Tia', 'Wang', 5, 5);");
                    for (var i=0; i<24; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(1);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE id < 11;");
                    for (var i=0; i<5; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(2);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE id in (25, 26, 27);");
                },
                app.dbError,
                function () {
                    console.log("Mock data ready.");
                });
        }

    };

    app.initialize();

    $("#popdb").click(function () {
        alert("PopDB");
        app.nukeDatabase();
        app.prepareDatabase();
        app.mockData();
        app.listStudentsForTeach(1);
    });


})(jQuery);

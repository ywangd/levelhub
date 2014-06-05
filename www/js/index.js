(function ($) {
    var db;

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).bind("deviceready", app.onDeviceReady)
            });
        },

        onDeviceReady: function () {
            db = window.openDatabase("levelhub", "1.0", "LevelHub", 65536);
            app.prepareDatabase();
            app.displayTeach(1);
            
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

            // Handle page transition to student stamp page
            $("#studentStamp").on("pagebeforeshow", function() {
                $(this).find(".ui-content").append($("<p>reg id is " + window.localStorage.getItem("selectedRegId")+"</p>"));
            });
        },

        displayTeach: function (teach_id) {
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
                                "href": "#studentStamp",
                                "data-transition": "slide",
                                text: row.user_fname + " " + row.user_lname
                            });
                            a.data("reg_id", row.id);
                            a.click(function() {
                                window.localStorage.setItem("selectedRegId", $(this).data("reg_id"));
                            });
                            ul.append($("<li>").append(a));
                        }
                        ul.listview('refresh');
                    },
                    app.dbError
                );
            });
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

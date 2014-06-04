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
            $("#teachRegs header a").click(function () {
                $.mobile.changePage($("#addStudent"), {
                    transition: "slidedown"
                });
            });
            $("#addStudent footer a:eq(1)").click(function () {
                var fields = [];
                $.each($("#newStudentForm").serializeArray(), function (idx, field) {
                    fields.push(field.value);
                });
                if (fields.toString() == ",,") {
                    alert("More information required");
                } else {
                    db.transaction(
                        function (tx) {
                            tx.executeSql("INSERT INTO Students (fname, lname, dname) VALUES (?, ?, ?);",
                                fields
                                );
                            tx.executeSql("INSERT INTO TeachRegs (teach, student, total, unused) VALUES" +
                                    "(1, 3, 0, 0);",
                                undefined,
                                function () {
                                    $.mobile.changePage($("#teachRegs"), {
                                        transition: "slideup"
                                    });
                                    app.listStudentsForTeach(1);
                                },
                                app.dbError)
                        });
                }
            });
        },

        displayTeach: function (teach_id) {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches WHERE id = ?",
                        [teach_id],
                        function (tx, result) {
                            var row = result.rows.item(0);
                            $("#teachRegs header h1").text(row.name);
                            app.listStudentsForTeach(teach_id);
                        })
                }
            );
        },

        nukeDatabase: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("DROP TABLE IF EXISTS TeachRegs;");
                    tx.executeSql("DROP TABLE IF EXISTS Students;");
                    tx.executeSql("DROP TABLE IF EXISTS Teaches;");
                }
            );
        },

        prepareDatabase: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("CREATE TABLE IF NOT EXISTS ClassMsgs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "srv_class INTEGER NOT NULL , " +
                        "srv_user INTEGER NOT NULL , " +
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
                        "srv_class INTEGER NOT NULL , " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Me (" +
                        "key VARCHAR PRIMARY KEY  NOT NULL , " +
                        "val TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Students (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "fname VARCHAR, " +
                        "lname VARCHAR, " +
                        "dname VARCHAR, " +
                        "data TEXT, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegLogs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "reg INTEGER NOT NULL , " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegs (" +
                        "id INTEGER PRIMARY KEY  AUTOINCREMENT  NOT NULL , " +
                        "teach INTEGER NOT NULL , " +
                        "student INTEGER NOT NULL , " +
                        "total INTEGER NOT NULL , " +
                        "unused INTEGER NOT NULL , " +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT, " +
                        "srv_id INTEGER);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Teaches (" +
                        "id INTEGER PRIMARY KEY  NOT NULL ," +
                        "name VARCHAR NOT NULL ," +
                        "desc TEXT," +
                        "is_active BOOL NOT NULL  DEFAULT 1 ," +
                        "ctime DATETIME NOT NULL  DEFAULT CURRENT_TIMESTAMP ," +
                        "data TEXT," +
                        "srv_id INTEGER);");

                },
                app.dbError,
                function () {
                    console.log("DB preparation completed.")
                });
        },

        mockData: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("INSERT INTO Teaches (name, desc) VALUES ('Folk Guitar Basics', 'An introductory lesson for people who want to pick up guitar fast with no previous experience');");
                    tx.executeSql("INSERT INTO Students (fname, lname) VALUES ('Emma', 'Wang');");
                    tx.executeSql("INSERT INTO Students (fname, lname) VALUES ('Tia', 'Wang');");
                    tx.executeSql("INSERT INTO TeachRegs (teach, student, total, unused) VALUES (1, 1, 24, 24);");
                    tx.executeSql("INSERT INTO TeachRegs (teach, student, total, unused) VALUES (1, 2, 5, 5);");
                },
                app.dbError,
                function () {
                    console.log("Mock data ready.");
                });
        },

        listStudentsForTeach: function (teach_id) {
            db.transaction(function (tx) {
                tx.executeSql(
                        "SELECT S.id, S.fname, S.lname, S.dname, S.srv_id, T.total, T.unused " +
                        "FROM TeachRegs T " +
                        "JOIN Students S ON T.student = S.id " +
                        "WHERE teach = ?;",
                    [teach_id],
                    function (tx, result) {
                        var ul = $("#studentList");
                        ul.empty();
                        for (var i = 0; i < result.rows.length; i++) {
                            var row = result.rows.item(i);
                            var li = $("<li>").append($("<a>", {
                                "href": "#studentStamp",
                                "data-transition": "slide",
                                text: row.fname + " " + row.lname
                            }));
                            ul.append(li);
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

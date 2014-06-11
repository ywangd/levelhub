(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var db;
    var students, currentStudent;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).bind("deviceready", app.onDeviceReady)
            });
        },

        onDeviceReady: function () {
            try {
                StatusBar.overlaysWebView(false);
            } catch (err) {
                // Just ignore it on android
            }
            //
            try {
                db = window.openDatabase("levelhub", "1.0", "LevelHub", 65536);
            } catch (err) {
                // If database cannot be opened, do not proceed further
                alert(err.message);
                return false;
            }
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
                var form = $("#newStudentForm");
                $.each(form.serializeArray(), function (idx, field) {
                    fields.push(field.value);
                });
                if (fields.toString() == ",") {
                    alert("More information required");
                } else {
                    fields.unshift($("#teachRegs").data("teach_id"));
                    db.transaction(
                        function (tx) {
                            tx.executeSql(
                                    "INSERT INTO TeachRegs (teach_id, user_fname, user_lname) " +
                                    "VALUES (?, ?, ?);",
                                fields,
                                function () {
                                    app.listStudentsForTeach(1);
                                    $.mobile.changePage($("#teachRegs"), {
                                        transition: "slideup"
                                    });
                                    form.get(0).reset();
                                },
                                app.dbError
                            );
                        });
                }
            });

            var stampsPages = $("#studentStamp-0, #studentStamp-1");
            var stampsContainers = stampsPages.find(".stamps-container");

            // Handle the transition from teachRegs to stamps page
            $("#studentList").on("click", "a", function () {
                var $this = $(this);
                currentStudent = students[$this.parent().prevAll().length];
                // Save the start values in case the operations are cancelled
                currentStudent.saved_total = currentStudent.total;
                currentStudent.saved_unused = currentStudent.unused;
                stampsPages.find("header h1").text(currentStudent.name);

                // No wobbly or delete badge when the stamps page is transitioned from teachRegs page
                var stampDoms = stampsContainers.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");

                db.transaction(
                    function (tx) {
                        tx.executeSql(
                            "SELECT * FROM TeachRegLogs WHERE reg_id = ?",
                            [currentStudent.reg_id],
                            function (tx, result) {
                                var length = result.rows.length;
                                // pre-set to last idx in case no unused slot is available
                                var firstUnusedIdx = length == 0 ? 0 : length - 1;
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
                                stampsDeleted = [];
                                for (var i = 0; i < length; i++) {
                                    var row = result.rows.item(i);
                                    stamps.push({
                                        updated: false,
                                        id: row.id,
                                        reg_id: row.reg_id,
                                        use_time: row.use_time,
                                        ctime: row.ctime,
                                        data: row.data,
                                        srv_id: row.srv_id
                                    });
                                }
                                var toPage = $("#studentStamp-0");
                                app.refreshStamps(toPage);
                                // Make sure the header is visible. It could be off during stamps page transition
                                toPage.find("header").css("visibility", "visible");
                                $.mobile.changePage(toPage, {
                                    transition: "slide"
                                });
                            });
                    });
                return false;
            });

            // Handle page transition for multi-page stamps
            stampsPages.find(".stampspage-content").on("swipeleft swiperight", function (event) {
                var currentPage = $(this).closest("section");
                var targetPage;
                if (currentPage.attr("id") == "studentStamp-0") {
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
                        // Simulate fixed persistent header during transition
                        currentPage.find("header").css("visibility", "hidden");
                        targetPage.find("header").css("visibility", "visible");
                        $.mobile.changePage(targetPage, {
                            transition: "slide"
                        });
                    }
                } else {
                    if (stampFirstIdx >= 9) {
                        stampFirstIdx -= 9;
                        stampLastIdx = stampFirstIdx + 9;
                        app.refreshStamps(targetPage);
                        // Simulate fixed persistent header during transition
                        currentPage.find("header").css("visibility", "hidden");
                        targetPage.find("header").css("visibility", "visible");
                        $.mobile.changePage(targetPage, {
                            transition: "slide",
                            reverse: true
                        });
                    }
                }
                return false;
            });

            // Handle stamps deletion and checkmark
            stampsContainers.on("tap", ".stamp", function (event) {
                var $this = $(this); // this is stamp
                var idxWithinPage = $this.parent().prevAll().length;
                var stampIdx = stampFirstIdx + idxWithinPage;
                var stamp = stamps[stampIdx];
                var page = $this.closest("section");

                if (event.target.className == "x-delete") {
                    // 1. Fade out the stamp dom by setting its display to none
                    // 2. Remove the stamp box dom to animate deletion (the animation
                    //    is achieved by pure css transition).
                    // 3. set the stamp dom to hidden and display to block (so it is
                    //    ready to be processed by refreshStamps
                    // 4. Add the stamp box dom to the end of the page
                    // 5. Call refreshStamps to display stamps correctly (this is mainly
                    //    just for the last inserted stamp box. Maybe it can be optimised
                    //    to only refresh the inserted stamp box dom.
                    $this.fadeOut("normal", function () {
                        currentStudent.total -= 1;
                        if (stamp.use_time == null) {
                            currentStudent.unused -= 1;
                        }
                        stampsDeleted.push(stamps.splice(stampIdx, 1)[0]);
                        // When deleting last stamp
                        if (stampLastIdx > stamps.length) {
                            stampLastIdx = stamps.length;
                        }

                        // Move the stamp box to the end of page as hidden but display is reverted to show
                        $this.addClass("hidden");
                        $this.show();
                        $this.parent().appendTo(page.find(".stamps-container"));

                        // Refresh the stamps page
                        app.refreshStamps(page);
                        // When deleting only stamp of a page
                        if (stampFirstIdx == stampLastIdx) {
                            page.find(".stampspage-content").trigger("swiperight");
                        }
                    });
                    return false;

                } else {
                    var unchecked = $this.find("img.checkmark").toggleClass("hidden").hasClass("hidden");
                    stamp.updated = true;
                    if (unchecked) {
                        stamp.use_time = null;
                        currentStudent.unused += 1;
                    } else {
                        var t = app.getCurrentTimestamp();
                        stamp.use_time = t;
                        currentStudent.unused -= 1;
                    }
                    // update the unused count display
                    page.find(".unusedCount").empty().text(currentStudent.unused);
                    return false;
                }
            });

            // Handle taphold for stamps deletion
            stampsContainers.on("taphold", ".stamp", function () {
                var stampDoms = stampsContainers.find(".stamp");
                stampDoms.toggleClass("wobbly");
                stampDoms.find("> img.x-delete").toggleClass("hidden");
            });

            // Handle cancel button on stamps page
            stampsPages.find("footer a:eq(0)").on("click", function () {
                currentStudent.total = currentStudent.saved_total;
                currentStudent.unused = currentStudent.saved_unused;
            });

            // Handle save button on stamps page
            stampsPages.find("footer a:eq(1)").on("click", function () {
                $.mobile.loading("show");
                var sqlParms = [];
                $.each(stamps, function (idx, stamp) {
                    if (stamp.updated) {
                        if (stamp.id == -1) { // new stamp
                            sqlParms.push([
                                "INSERT INTO TeachRegLogs (reg_id, use_time) VALUES (?, ?);",
                                [stamp.reg_id, stamp.use_time]]);
                        } else {
                            sqlParms.push([
                                "UPDATE TeachRegLogs SET use_time = ? WHERE id = ?;",
                                [stamp.use_time, stamp.id]]);
                        }
                    }
                });
                db.transaction(
                    function (tx) {
                        // update TeachRegLogs
                        $.each(sqlParms, function (idx, sqlParm) {
                            tx.executeSql(sqlParm[0], sqlParm[1]);
                        });

                        // Delete any deleted logs
                        $.each(stampsDeleted, function (idx, stamp) {
                            if (stamp.id != -1) {
                                tx.executeSql("DELETE FROM TeachRegLogs WHERE id = ?;", [stamp.id]);
                            }
                        });

                        tx.executeSql(
                            "UPDATE TeachRegs SET total = ?, unused = ? WHERE id = ?;",
                            [currentStudent.total, currentStudent.unused, currentStudent.reg_id]
                        );
                    },
                    app.dbError,
                    function () {
                        var idx = students.indexOf(currentStudent);
                        var toPage = $("#teachRegs");
                        toPage.find("ul a span").eq(idx).empty().text(currentStudent.unused);
                        $.mobile.changePage(toPage, {
                            transition: "pop",
                            reverse: true
                        });
                    }
                );
            });

             // Cancel wobbly when top up is about to show
            stampsPages.find("header a[href^='#topUpDialog']").on("click", function () {
                var stampDoms = stampsContainers.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");
            });

            // sync top up slider value and Handle OK button on Top up dialog
            $("#topUpDialog0, #topUpDialog1").find("a").on("click", function () {
                var thisSlider = $(this).closest("div").find("input");
                var thatSlider;
                var value = parseInt(thisSlider.val());
                if (thisSlider.attr("id") == "topup-slider0") {
                    thatSlider = $("#topup-slider1");
                } else {
                    thatSlider = $("#topup-slider0");
                }
                if (thatSlider.data("mobile-slider")) { // already enhanced
                    thatSlider.val(value).slider("refresh");
                } else { // not yet enhanced
                    thatSlider.attr("value", value);
                }
                // Top up
                if (this.textContent == "Ok") {
                    for (var i = 0; i < value; i++) {
                        stamps.push({
                            updated: true,
                            id: -1,
                            reg_id: currentStudent.reg_id,
                            use_time: null,
                            ctime: app.getCurrentTimestamp()
                        });
                    }
                    var page = $(this).closest("section");
                    currentStudent.unused += value;
                    currentStudent.total += value;
                    app.refreshStampsCount(page);
                    if (stampLastIdx - stampFirstIdx < 9) {
                        stampLastIdx = Math.min(stampFirstIdx + 9, stamps.length);
                        app.refreshStamps(page);
                    }
                }
            });

            // Debug function to deal with the slowness of android emulator
            $(document).keyup(function (event) {
                if ($.mobile.activePage.attr("id") == "studentStamp-0" || $.mobile.activePage.attr("id") == "studentStamp-1") {
                    if (event.which == 65) {
                        $.mobile.activePage.find(".ui-content").trigger("swiperight");
                    } else if (event.which == 68) {
                        $.mobile.activePage.find(".ui-content").trigger("swipeleft");
                    }
                }
                return false;
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
                        students = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            var row = result.rows.item(i);
                            var student = app.populateStudent(row);
                            students.push(student);
                            var a = $("<a>", {
                                "href": "#",
                                text: student.name
                            });
                            a.append($("<span>", {
                                class: "ui-li-count ui-btn-up-c ui-btn-corner-all",
                                text: row.unused
                            }));
                            ul.append($("<li>").append(a));
                        }
                        ul.listview('refresh');
                    },
                    app.dbError
                );
            });
        },

        populateStudent: function (row) {
            var student = {
                fname: row.user_fname,
                lname: row.user_lname,
                reg_id: row.id,
                total: row.total,
                unused: row.unused,
                srv_id: row.srv_id
            };
            var name = row.user_fname;
            if (row.user_lname != '') {
                name += ' ' + row.user_lname;
            }
            student.name = name;
            return student;
        },

        refreshStamps: function (page) {
            var stampDoms = page.find(".stamp");
            var imgDoms = stampDoms.find("img.checkmark");
            stampDoms.addClass("hidden");
            imgDoms.addClass("hidden");
            for (var i = stampFirstIdx; i < stampLastIdx; i++) {
                var stamp = stamps[i];
                stampDoms.eq(i - stampFirstIdx).removeClass("hidden");
                if (stamp.use_time != null) {
                    imgDoms.eq(i - stampFirstIdx).removeClass("hidden");
                }
            }
            app.refreshStampsCount(page);
        },

        refreshStampsCount: function (page) {
            page.find(".pageCount").empty().text(
                    (Math.floor(stampFirstIdx / 9) + 1) + "/" + Math.max(Math.ceil(stamps.length / 9), 1));
            page.find(".unusedCount").empty().text(currentStudent.unused);
        },

        getCurrentTimestamp: function () {
            var now = new Date();
            var mon = now.getMonth() + 1;
            var date = now.getDate();
            var hour = now.getHours();
            var min = now.getMinutes();
            var sec = now.getSeconds();
            if (mon < 10) mon = '0' + mon;
            if (date < 10) date = '0' + date;
            if (hour < 10) hour = '0' + hour;
            if (min < 10) min = '0' + min;
            if (sec < 10) sec = '0' + sec;

            var ret = now.getFullYear() + '-' + mon + '-' + date + ' ' + hour + ':' + min + ':' + sec;
            return ret;
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
                    tx.executeSql("INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) VALUES (1, 'Emma', 'Wang', 24, 14);");
                    tx.executeSql("INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) VALUES (1, 'Tia', 'Wang', 5, 2);");
                    for (var i = 0; i < 24; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(1);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE id < 11;");
                    for (var i = 0; i < 5; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(2);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE id IN (25, 26, 27);");
                },
                app.dbError,
                function () {
                    console.log("Mock data ready.");
                });
        }

    };

    app.initialize();

    $("#popdb").click(function () {
        console.log("PopDB");
        app.nukeDatabase();
        app.prepareDatabase();
        app.mockData();
        app.listStudentsForTeach(1);
    });


})(jQuery);

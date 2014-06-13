(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var db;
    var students, currentStudent;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;
    var homeNavIdx = -1;
    var teaches, currentTeach;
    var listTapable = true;

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).bind("deviceready", app.onDeviceReady);
            });
        },

        onDeviceReady: function () {
            // Always show status bar above the app for iOS
            try {
                StatusBar.overlaysWebView(false);
            } catch (err) {
                // Just ignore it on android
            }

            // Database init
            try {
                db = window.openDatabase("levelhub", "1.0", "LevelHub", 65536);
            } catch (err) {
                // If database cannot be opened, do not proceed further
                alert(err.message);
                return false;
            }
            app.prepareDatabase();

            // All pages
            var pageHome = $("#home"),
                homeHeader = pageHome.find("#home-header"),
                homeContentDivs = pageHome.find(".ui-content");

            var pageTeachRegs = $("#teach-regs-page"),
                pageNewstudent = $("#new-student"),
                pageStamps = $("#stamps-page"),
                stampsContainers = pageStamps.find(".stamps-container");

            // home page init
            // Handle home nav icon press
            pageHome.on("click", "#icon-news, #icon-teach, #icon-study, #icon-setup", function () {
                var $this = $(this);
                var idx = $this.parent().prevAll().length;
                // Do nothing if the nav button is already the current active one
                if (idx != homeNavIdx) {
                    homeNavIdx = idx;
                    // Still need to manually manage classes to make highlight button persistent
                    $this.parent().siblings().find("a").removeClass("ui-btn-active ui-state-persist");
                    $this.addClass("ui-btn-active ui-state-persist");

                    homeContentDivs.hide();
                    var activeContentDiv = homeContentDivs.eq(idx);
                    activeContentDiv.show();

                    switch (activeContentDiv.attr("id")) {
                        case "news":
                            homeHeader.find("h1").text("Recent News");
                            break;
                        case "teach":
                            homeHeader.find("h1").text("My Teachings");
                            app.prepareTeachs();
                            break;
                        case "study":
                            homeHeader.find("h1").text("My Learnings");
                            break;
                        case "setup":
                            homeHeader.find("h1").text("Settings");
                            break;
                    }
                }
                return false;
            });

            // The first page to show
            $("#icon-news").trigger("click");

            // Handle click on teach list
            $("#teach-list").on("click", "a", function () {
                var $this = $(this);
                currentTeach = teaches[$this.parent().prevAll().length];
                app.prepareTeachRegs(currentTeach.teach_id);
                $.mobile.changePage(pageTeachRegs, {
                    transition: "slide"
                });
            });

            // Handle Save button for new student page
            pageNewstudent.find("footer a:eq(1)").click(function () {
                var fields = [];
                var form = $("#new-student-form");
                $.each(form.serializeArray(), function (idx, field) {
                    fields.push(field.value);
                });

                if (fields.toString() == ",") {
                    alert("More information required");
                    console.log("More information required");
                } else {
                    fields.unshift(currentTeach.teach_id);
                    db.transaction(
                        function (tx) {
                            currentTeach.nregs += 1;
                            tx.executeSql(
                                "INSERT INTO TeachRegs (teach_id, user_fname, user_lname) " +
                                    "VALUES (?, ?, ?);",
                                fields
                            );
                            tx.executeSql(
                                "UPDATE Teaches SET nregs = ? WHERE id = ?;",
                                [currentTeach.nregs, currentTeach.teach_id]);
                        },
                        app.dbError,
                        function () {
                            app.listStudentsForTeach(currentTeach.teach_id);
                            $.mobile.changePage(pageTeachRegs, {
                                transition: "slideup"
                            });
                            form.get(0).reset();
                            var idxTeachList = teaches.indexOf(currentTeach);
                            homeContentDivs.eq(homeNavIdx).find("ul a span").eq(idxTeachList).empty().text(currentTeach.nregs);
                        });
                }
            });

            // Handle the transition from teach regs page to stamps page
            $("#student-list").on("click", "a", function () {
                // Do not process tap is a swipe event is in process
                if (! listTapable) {
                    return false;
                }
                var $this = $(this);
                currentStudent = students[$this.parent().prevAll().length];
                // Save the start values in case the operations are cancelled
                currentStudent.saved_total = currentStudent.total;
                currentStudent.saved_unused = currentStudent.unused;
                pageStamps.find("header h1").text(currentStudent.name);

                // No wobbly or delete badge when the stamps page is transitioned
                // from teach regs page
                var stampDoms = stampsContainers.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");

                db.transaction(
                    function (tx) {
                        tx.executeSql(
                            "SELECT * FROM TeachRegLogs WHERE reg_id = ?;",
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
                                // Prepare the stamps display
                                app.updateStampsContainer(pageStamps.find(".stamps-container:eq(0)"));
                                // transition
                                $.mobile.changePage(pageStamps, {
                                    transition: "slide"
                                });
                            });
                    });
                return false;
            });

            $("#student-list").on("swipeleft swiperight", "li", function (event) {
                listTapable = false;
                if (event.type == "swipeleft") {
                    $("#student-list").find("a").prepend('<img src="img/bar-delete.svg" class="bar-delete"/>');
                    $("#student-list").find("li a").removeClass('ui-icon-carat-r');
                    $("#student-list").find("li a").addClass('ui-icon-bars');
                } else {
                    setTimeout(function () {
                        listTapable = true;
                    }, 500);
                    $("#student-list").find("img").remove();
                    $("#student-list").find("li a").removeClass('ui-icon-bars');
                    $("#student-list").find("li a").addClass('ui-icon-carat-r');

                }
                return false;
            });

            // Set the second stamps container to off screen at start up
            pageStamps.eq(0).find(".stamps-container:eq(1)").css("left", "150%");

            // Handle swipe transitions between stamps container divs
            pageStamps.find(".stampspage-content").on("swipeleft swiperight", function (event) {
                var $this = $(this);

                var divs = $this.find(".stamps-container"),
                    outDiv = divs.eq(0), inDiv = divs.eq(1),
                    speed = 400;

                var length = stamps.length;

                function animateStampsContainers(left_start, left_end) {
                    inDiv.css("left", left_start);
                    outDiv.animate(
                        {left: left_end},
                        speed,
                        function () {
                            outDiv.appendTo($this);
                        }
                    );
                    inDiv.animate(
                        {left: 0},
                        speed
                    );
                }

                if (event.type == "swipeleft") {
                    if (stampLastIdx < length) {
                        stampFirstIdx = stampLastIdx;
                        stampLastIdx = Math.min(stampFirstIdx + 9, length);
                        // refresh target stamps-container
                        app.updateStampsContainer(inDiv);
                        // animate the transition
                        animateStampsContainers("150%", "-150%");
                    }
                } else {
                    if (stampFirstIdx >= 9) {
                        stampFirstIdx -= 9;
                        stampLastIdx = stampFirstIdx + 9;
                        // refresh target stamps-contaier
                        app.updateStampsContainer(inDiv);
                        // animate the transition
                        animateStampsContainers("-150%", "150%");
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

                        // Move the stamp box to the end of current stamps container
                        // as hidden but display is reverted to show
                        $this.addClass("hidden");
                        $this.show();
                        var stampsContainer = $this.closest(".stamps-container")
                        $this.parent().appendTo(stampsContainer);

                        // Refresh the stamps container
                        app.updateStampsContainer(stampsContainer);

                        // When deleting only stamp of a page, trigger swipe
                        if (stampFirstIdx == stampLastIdx) {
                            stampsContainer.closest(".stampspage-content").trigger("swiperight");
                        }
                    });
                    return false;

                } else {
                    // Tap for checkmark is not processed if wobbly is on
                    if (!$this.hasClass("wobbly")) {
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
                    }
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
            pageStamps.find("footer a:eq(0)").on("click", function () {
                currentStudent.total = currentStudent.saved_total;
                currentStudent.unused = currentStudent.saved_unused;
            });

            // Handle save button on stamps page
            pageStamps.find("footer a:eq(1)").on("click", function () {
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
                        var idxStudentList = students.indexOf(currentStudent);
                        pageTeachRegs.find("ul a span").eq(idxStudentList).empty().text(currentStudent.unused);

                        $.mobile.changePage(pageTeachRegs, {
                            transition: "pop",
                            reverse: true
                        });
                    }
                );
            });

            // Cancel wobbly when top up is about to show
            pageStamps.find("header a[href='#topup-dialog']").on("click", function () {
                var stampDoms = stampsContainers.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");
            });

            // sync top up slider value and Handle OK button on Top up dialog
            $("#topup-dialog").find("a").on("click", function () {
                var $this = $(this);
                var slider = $this.closest("div").find("input");
                var value = parseInt(slider.val());
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
                    var page = $this.closest("section");
                    currentStudent.unused += value;
                    currentStudent.total += value;
                    app.updateStampsCount(page);
                    if (stampLastIdx - stampFirstIdx < 9) {
                        stampLastIdx = Math.min(stampFirstIdx + 9, stamps.length);
                        app.updateStampsContainer(page.find(".stamps-container:eq(0)"));
                    }
                }
            });

            // Debug function to deal with the slowness of android emulator
            $(document).keyup(function (event) {
                if ($.mobile.activePage.attr("id") == "stamps-page" || $.mobile.activePage.attr("id") == "studentStamp-1") {
                    if (event.which == 65) {
                        $.mobile.activePage.find(".ui-content").trigger("swiperight");
                    } else if (event.which == 68) {
                        $.mobile.activePage.find(".ui-content").trigger("swipeleft");
                    }
                }
                return false;
            });
        },

        prepareTeachs: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches;",
                        undefined,
                        function (tx, result) {
                            var ul = $("#teach-list");
                            ul.empty();
                            teaches = [];
                            for (var i = 0; i < result.rows.length; i++) {
                                var row = result.rows.item(i);
                                var teach = app.populateTeach(row);
                                teaches.push(teach)
                                var a = $("<a>", {
                                    "href": "#",
                                    text: teach.name
                                });
                                a.append($("<span>", {
                                    class: "ui-li-count ui-btn-up-c ui-btn-corner-all",
                                    text: teach.nregs
                                }));
                                ul.append($("<li>").append(a));
                            }
                            ul.listview("refresh");
                        },
                        app.dbError)
                }
            );
        },

        populateTeach: function (row) {
            var teach = {
                teach_id: row.id,
                name: row.name,
                desc: row.desc,
                nregs: row.nregs,
                is_active: row.is_active,
                ctime: row.ctime,
                data: row.data,
                srv_id: row.srv_id
            };
            return teach;
        },

        prepareTeachRegs: function (teach_id) {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches WHERE id = ?;",
                        [teach_id],
                        function (tx, result) {
                            var row = result.rows.item(0);
                            var pageTeachRegs = $("#teach-regs-page");
                            pageTeachRegs.data("teach_id", teach_id);
                            pageTeachRegs.data("desc", row.desc);
                            pageTeachRegs.find("header h1").text(row.name);
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
                        var ul = $("#student-list");
                        ul.empty();
                        students = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            var row = result.rows.item(i);
                            var student = app.populateStudent(row);
                            students.push(student);
                            var a = $("<a>", {
                                href: "#",
                                text: student.name
                            });
                            a.append($("<span>", {
                                class: "ui-li-count ui-btn-up-c ui-btn-corner-all",
                                text: row.unused
                            }));
                            ul.append($("<li>").append(a));
                        }
                        ul.listview("refresh");
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

        updateStampsContainer: function (div) {
            var stampDoms = div.find(".stamp");
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
            app.updateStampsCount(div.closest("section"));
        },

        updateStampsCount: function (page) {
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
                        "nregs INTEGER NOT NULL DEFAULT 0, " + // number of registered students
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
                    tx.executeSql(
                        "INSERT INTO Teaches (name, desc, nregs) " +
                            "VALUES ('Folk Guitar Basics', " +
                            "'An introductory lesson for people who want to pick up guitar fast with no previous experience', " +
                            "2);");
                    tx.executeSql(
                        "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) " +
                            "VALUES (1, 'Emma', 'Wang', 24, 14);");
                    tx.executeSql(
                        "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused) " +
                            "VALUES (1, 'Tia', 'Wang', 5, 2);");
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

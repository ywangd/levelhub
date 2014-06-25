(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var db;
    var students, currentStudent;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;
    var homeNavIdx = -1;
    var teaches, currentTeach;
    var days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"],
        periods = ["AM", "PM"];

    var re_email = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    var QERR = "err";
    var server_url = "http://levelhub-ywangd.rhcloud.com/";
    server_url = "http://localhost:8000/";

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
                console.log(err.message);
            }

            // Database init
            try {
                db = window.openDatabase("levelhub", "1.0", "LevelHub", 65536);
            } catch (err) {
                // If database cannot be opened, do not proceed further
                alert(err.message);
                console.log(err.message);
                return false;
            }
            app.prepareDatabase();

            // This is always called when any ajax call is successfully return, unless
            // its global option is set to false
            $(document).ajaxSuccess(function (event, xhr, settings) {
                //console.log(event);
                //console.log(xhr);
                //console.log(settings);
            });

            // Some always need ajax parameters
            $.ajaxSetup({
                dataType: "json",
                xhrFields: {
                    withCredentials: true
                },
                crossDomain: true,
                //headers: {"Cookie": "sessionid=6376m4cf23tr2lq8x5o4r36hztrjm925"},
                timeout: 9000
            });

            // Always attach json as a parameter to request for json data
            $.ajaxPrefilter(function (options) {
                if (typeof options.data == "string") {
                    options.data = "json=&" + options.data;
                } else {
                    options.data = $.extend(options.data, {json: ""});
                }
            });

            // All pages and parts
            app.doms = {
                pageLogin: $("#login"),
                pageRegister: $("#register"),
                pageHome: $("#home"),
                pageNewTeach: $("#new-teach"),
                pageTeachRegs: $("#teach-regs-page"),
                pageNewStudent: $("#new-student"),
                pageStamps: $("#stamps-page"),
                pageTeachRegsDetails: $("#teach-regs-details-page"),
                pageStudentDetails: $("#student-details-page"),
                headerHome: $("#home-header"),
                btnHomeUR: $("#home-btn-right"),
                listStudents: $("#student-list"),
                listTeaches: $("#teach-list"),
                popNewStudentDaytime: $("#new-student-daytime-dialog"),
                listNewStudentDaytime: $("#new-student-daytime-list"),
                listStudentHistory: $("#student-history"),
                listStudentDaytime: $("#student-daytime-list")
            };

            app.doms.divsHomeContent = app.doms.pageHome.find(".ui-content");
            app.doms.containersStamps = app.doms.pageStamps.find(".stamps-container");

            // home page init
            // Handle home nav icon press
            app.doms.pageHome.on("click", "#icon-news, #icon-teach, #icon-study, #icon-setup", function () {
                var $this = $(this);
                var idx = $this.parent().prevAll().length;
                // Do nothing if the nav button is already the current active one
                if (idx != homeNavIdx) {
                    $.mobile.loading("show");
                    homeNavIdx = idx;
                    // Still need to manually manage classes to make highlight button persistent
                    $this.parent().siblings().find("a").removeClass("ui-btn-active ui-state-persist");
                    $this.addClass("ui-btn-active ui-state-persist");

                    switch (app.doms.divsHomeContent.eq(idx).attr("id")) {
                        case "news":
                            app.doms.headerHome.find("h1").text("Recent News");
                            app.doms.btnHomeUR.removeClass("ui-icon-plus")
                                .addClass("ui-icon-refresh").show();
                            app.finishHomeNav();
                            break;
                        case "teach":
                            app.doms.headerHome.find("h1").text("My Teachings");
                            app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                                .addClass("ui-icon-plus").attr({
                                    "href": "#new-teach",
                                    "data-transition": "slidedown"
                                }).show();

                            app.prepareTeaches();
                            break;
                        case "study":
                            app.doms.headerHome.find("h1").text("My Learnings");
                            app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                                .addClass("ui-icon-plus").show();
                            app.finishHomeNav();
                            break;
                        case "setup":
                            app.doms.headerHome.find("h1").text("Settings");
                            app.doms.btnHomeUR.hide();
                            app.finishHomeNav();
                            break;
                    }
                }
                return false;
            });

            // The first page to show
            //$("#icon-teach").trigger("click");

            $("#login-btn").on("click", function () {
                var loginPanel = $("#login-panel"),
                    form = loginPanel.find("form"),
                    loginFeedback = $("#login-feedback span");
                $.ajax({
                    type: "POST",
                    url: server_url + "login/",
                    data: form.serialize()
                })
                    .done(function (data) {
                        console.log(data);
                        if (QERR in data) {
                            loginFeedback.empty().text(data[QERR]);
                        } else {
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "slideup"
                            });
                            $("#icon-teach").trigger("click");
                            loginFeedback.empty();
                            form[0].reset();
                        }
                    })
                    .fail(function (data, textStatus, errorThrown) {
                        console.log(data);
                        console.log(textStatus);
                        console.log(errorThrown);
                        console.log("FAILED");
                        $("#login-feedback").empty().text("Server error. Please try again.");
                    });
            });

            $("#logout-btn").on("touchstart click", function () {
                $.ajax({
                    type: "POST",
                    url: server_url + "logout/",
                    data: ""
                })
                    .always(function (data) {
                        $.mobile.changePage(app.doms.pageLogin, {
                            transition: "slidedown"
                        });
                    })
                    .fail(function (data, textStatus, errorThrown) {
                        console.log(data);
                        console.log(textStatus);
                        console.log(errorThrown);
                        console.log("FAILED");
                    });
            });

            $("#register-btn").on("click", function () {
                var registerPanel = $("#register-panel"),
                    form = registerPanel.find("form"),
                    formData = form.serializeArray(),
                    registerFeedback = $("#register-feedback span"),
                    data = {};

                form.find("label span").empty();

                $.each(formData, function (idx, field) {
                    data[field.name] = $.trim(field.value);
                });

                if (data["username"] == "") {
                    form.find("label:eq(0) span").text("Required");
                }

                if (data["email"] != "" && !re_email.test(data["username"])) {
                    form.find("label:eq(2) span").text("Invalid email");
                }

                if (data["password1"] == "") {
                    form.find("label:eq(3) span").text("Required");
                } else if (data["password1"].length < 4) {
                    form.find("label:eq(3) span").text("Too short");
                }

                if (data["password2"] != data["password1"]) {
                    form.find("label:eq(4) span").text("does not match");
                }

                // If any of the span has warning message, the form is not valid
                if (form.find("label span").text() != "") {
                    return false;
                } else {
                    console.log(data);
                    $.ajax({
                        type: "POST",
                        url: server_url + "register/",
                        data: data
                    })
                        .done(function (data) {
                            console.log(data);
                            if (QERR in data) {
                                if ("username" in data.err) {
                                    form.find("label:eq(0) span").text(data.err["username"]);
                                }
                            } else {
                                $.mobile.changePage(app.doms.pageHome, {
                                    transition: "slideup"
                                });
                                $("#icon-teach").trigger("click");
                                registerFeedback.empty();
                                form.find("label span").empty();
                                form[0].reset();
                            }
                        })
                        .fail(function (data, textStatus, errorThrown) {
                            console.log(data);
                            console.log(textStatus);
                            console.log(errorThrown);
                            console.log("FAILED");
                            registerFeedback.empty().text("Server error. Please try again.");
                        });
                }
            });

            // Handle home page upper right button, note this button reacts
            // different based on different active home section
            app.doms.btnHomeUR.on("click", function () {
                switch (app.doms.divsHomeContent.eq(homeNavIdx).attr("id")) {
                    case "news":
                        break;
                    case "teach":
                        break;
                    case "study":
                        break;
                    case "setup":
                        break;
                }
            });

            // Save button on new teach page
            app.doms.pageNewTeach.find("footer a:eq(1)").on("click", function () {
                var form = $(this).closest("section").find("form"),
                    fields = [];
                $.each(form.serializeArray(), function (idx, field) {
                    fields.push($.trim(field.value));
                });
                // Must have name for the new teach class
                if (fields[0] == "") {
                    navigator.notification.alert(
                        "A class name is required.",
                        undefined,
                        "Invalid Input"
                    );
                    console.log("A class name is required.");
                } else {
                    db.transaction(
                        function (tx) {
                            tx.executeSql(
                                "INSERT INTO Teaches (name, desc) VALUES (?, ?);",
                                fields
                            );
                        },
                        app.dbError,
                        function () {
                            form[0].reset();
                            app.prepareTeaches();
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "pop",
                                reverse: true
                            })
                        }
                    );
                }

            });

            // Handle click on teach list
            app.doms.listTeaches.on("click", "a", function () {
                var $this = $(this);
                currentTeach = teaches[$this.parent().prevAll().length];
                app.prepareTeachRegs(currentTeach.teach_id);
                $.mobile.changePage(app.doms.pageTeachRegs, {
                    transition: "slide"
                });
            });

            // Handle details button on teach regs page
            $("#teach-details-button").on("click", function () {
                var li0 = app.doms.pageTeachRegsDetails.find(".ui-content li:eq(0)");
                li0.find("h2").text(currentTeach.name);
                li0.find("p:eq(0)").text(currentTeach.desc);
                li0.find("p:eq(1)").text("Created: " + currentTeach.ctime.split(" ")[0]);
                $.mobile.changePage(app.doms.pageTeachRegsDetails, {
                    transition: "flip"
                });
                return false;
            });

            // fill the current teach details for popup
            app.doms.pageTeachRegsDetails.on("pageshow", function () {
                var popup0 = $("#teach-edit-popup-0");
                popup0.find("input").val(currentTeach.name);
                popup0.find("textarea").val(currentTeach.desc);
            });

            // Handle save on teach regs details page
            $("#teach-edit-popup-0").find("a:eq(1)").on("click", function () {
                db.transaction(
                    function (tx) {
                        var popup0 = $("#teach-edit-popup-0");
                        currentTeach.name = popup0.find("input").val();
                        currentTeach.desc = popup0.find("textarea").val();
                        tx.executeSql(
                            "UPDATE Teaches SET name = ?, desc = ? WHERE teach_id = ?;",
                            [currentTeach.name, currentTeach.desc, currentTeach.teach_id]
                        );
                    },
                    app.dbError,
                    function () {
                        var li0 = app.doms.pageTeachRegsDetails.find(".ui-content li:eq(0)");
                        li0.find("h2").text(currentTeach.name);
                        li0.find("p:eq(0)").text(currentTeach.desc);
                        app.doms.pageTeachRegs.find("header h1").text(currentTeach.name);
                        var idxTeachList = teaches.indexOf(currentTeach);
                        app.doms.divsHomeContent.eq(homeNavIdx).find("ul a").eq(idxTeachList)
                            .get(0).firstChild.nodeValue = currentTeach.name;
                    }
                );
            });

            // Handle teach delete button
            $("#teach-delete-button").on("click", function () {
                navigator.notification.confirm("The operation is not reversible!", function (btnIdx) {
                    if (btnIdx == 1) {
                        db.transaction(
                            function (tx) {
                                tx.executeSql(
                                    "DELETE FROM TeachRegLogs WHERE reg_id IN (SELECT reg_id FROM TeachRegs WHERE teach_id = ?);",
                                    [currentTeach.teach_id]
                                );
                                tx.executeSql(
                                    "DELETE FROM TeachRegs WHERE teach_id = ?;",
                                    [currentTeach.teach_id]
                                );
                                tx.executeSql(
                                    "DELETE FROM Teaches WHERE teach_id = ?;",
                                    [currentTeach.teach_id]
                                );
                            },
                            app.dbError,
                            function () {
                                homeNavIdx = -1; // force reload on teach list page
                                $("#icon-teach").trigger("click");
                                $.mobile.changePage(app.doms.pageHome, {
                                    transition: "pop",
                                    reverse: true
                                });
                            }
                        );
                    }
                }, "Delete class?");
                return false;
            });

            // prepare daytime picker when the containing page is first shown
            app.doms.pageStudentDetails.add(app.doms.pageNewStudent).on("pageshow", function () {
                var page = $(this),
                    popup = page.find(".daytime-dialog"),
                    idPrefix = page.attr("id");

                // Pickerize the control only if they have not been pickerized
                if ($("#uipv_main_" + idPrefix + "-day").length == 0) {
                    var selects = popup.find("select");
                    // dynamically assign the id for each control and namespace
                    // them with the page id.
                    // id attribute is required by pickerization
                    $.each(["day", "hour", "min", "ampm"], function (idx, val) {
                        selects.eq(idx).attr("id", idPrefix + "-" + val);
                    });
                    // Set proper dimension of the popup
                    var content = page.find(".ui-content:eq(0)"),
                        fontSize = content.css("font-size"),
                        width = content.width() / 5;
                    popup.css("width", width * 5 + "px");
                    // day
                    selects.eq(0).iPhonePicker({
                        width: width * 2 + "px",
                        fontSize: fontSize
                    });
                    // populate hours
                    for (var i = 1; i < 13; i++) {
                        $("<option>", {text: i < 10 ? "0" + i : i})
                            .attr(i == 1 ? {"selected": "selected"} : {})
                            .appendTo(selects.eq(1));
                    }
                    // populate miniutes
                    for (i = 0; i < 60; i++) {
                        $("<option>", {text: i < 10 ? "0" + i : i})
                            .attr(i == 0 ? {"selected": "selected"} : {})
                            .appendTo(selects.eq(2));
                    }
                    // hour, min, ampm
                    selects.slice(1).iPhonePicker({
                        width: width + "px",
                        fontSize: fontSize
                    });
                }
            });

            // Modify the DOM accordingly based on which element invoke
            // the daytime dialog. Also sets the initial value of daytime
            // dialog accordingly as well.
            $(".daytime-dialog").on("click", "a", function () {
                var popup = $(this).closest(".daytime-dialog"),
                    selecteds = popup.find("option[selected]");
                var daytime = selecteds.eq(0).text() + " "
                    + selecteds.eq(1).text() + ":"
                    + selecteds.eq(2).text() + " "
                    + selecteds.eq(3).text();
                if (popup.data("target")) {
                    popup.data("target").text(daytime);
                } else {
                    popup.closest("section").find(".daytime-list")
                        .append($("<li>").append($("<a>", {href: "#", text: daytime}))
                            .append($("<a>", {href: "#", text: "delete"})))
                        .listview("refresh");
                }
            }).on("popupafterclose", function () {
                $(this).removeData("target");
            });

            // handle the click on daytime list, either delete or modify
            $(".daytime-list").on("click", "a", function () {
                var $this = $(this),
                    list = $this.closest("ul");
                if ($this.attr("title") == "delete") {
                    $this.closest("li").remove();
                    list.listview("refresh");
                } else {
                    var fields = app.parseClassDaytime($this.text());
                    var popup = list.closest("section").find(".daytime-dialog"),
                        selects = popup.find("select");
                    $.each(selects, function (idx, select) {
                        select.selectedIndex = fields[idx];
                        selects.eq(idx).iPhonePickerRefresh();
                    });
                    popup.data("target", $this).popup("open", {
                        transition: "slideup"
                    });
                }
            });

            // Handle done button on student details page
            // It modifies the currentStudent object if data is changed
            // the object is later persistent into the database if save button
            // is clicked on the stamps page.
            app.doms.pageStudentDetails.find("header a").on("click", function () {
                var daytime = [];
                $.each($(this).closest("section").find(".daytime-list li a:not([title='delete'])"),
                    function (idx, dom) {
                        daytime.push(dom.innerHTML);
                    });
                if (!app.vectorIsIdentical(currentStudent.data.daytime, daytime)) {
                    currentStudent.data.daytime = daytime;
                }
            });

            // Handle Save button for new student page
            app.doms.pageNewStudent.find("footer a:eq(1)").click(function () {
                var form = $("#new-student-form"),
                    fields = [];
                $.each(form.serializeArray(), function (idx, field) {
                    fields.push($.trim(field.value));
                });

                if (fields.indexOf("") >= 0) {
                    navigator.notification.alert(
                        "Name is required.",
                        undefined,
                        "Invalid Input"
                    );
                    console.log("Name is required");
                } else {
                    fields.unshift(currentTeach.teach_id);
                    // add any class daytime entries
                    var data = {daytime: []};
                    $.each(app.doms.listNewStudentDaytime.find("li a:not([title='delete'])"),
                        function (idx, dom) {
                            data.daytime.push(dom.innerHTML);
                        });
                    fields.push(JSON.stringify(data));
                    db.transaction(
                        function (tx) {
                            currentTeach.nregs += 1;
                            tx.executeSql(
                                    "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, data) " +
                                    "VALUES (?, ?, ?, ?);",
                                fields
                            );
                            tx.executeSql(
                                "UPDATE Teaches SET nregs = ? WHERE teach_id = ?;",
                                [currentTeach.nregs, currentTeach.teach_id]
                            );
                        },
                        app.dbError,
                        function () {
                            app.listStudentsForTeach(currentTeach.teach_id);
                            $.mobile.changePage(app.doms.pageTeachRegs, {
                                transition: "slideup"
                            });
                            form.get(0).reset();
                            app.doms.listNewStudentDaytime.empty();
                            var idxTeachList = teaches.indexOf(currentTeach);
                            app.doms.divsHomeContent.eq(homeNavIdx).find("ul a span").eq(idxTeachList).empty().text(currentTeach.nregs);
                        });
                }
            });

            // Handle the transition from teach regs page to stamps page
            app.doms.listStudents.on("click", "a", function () {
                var $this = $(this);
                currentStudent = students[$this.parent().prevAll(":not(.ui-li-divider)").length];
                // Save the start values in case the operations are cancelled
                currentStudent.saved_total = currentStudent.total;
                currentStudent.saved_unused = currentStudent.unused;
                currentStudent.saved_data = JSON.stringify(currentStudent.data);
                app.doms.pageStamps.find("header h1").text(currentStudent.name);

                // No wobbly or delete badge when the stamps page is transitioned
                // from teach regs page
                var stampDoms = app.doms.containersStamps.find(".stamp");
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
                                stamps = [];
                                stampsDeleted = [];
                                for (var i = 0; i < length; i++) {
                                    var row = result.rows.item(i);
                                    if (!row.use_time && i < firstUnusedIdx) {
                                        firstUnusedIdx = i;
                                    }
                                    stamps.push({
                                        updated: false,
                                        log_id: row.log_id,
                                        reg_id: row.reg_id,
                                        use_time: row.use_time,
                                        ctime: row.ctime,
                                        data: row.data
                                    });
                                }
                                var currentPageIdx = Math.floor(firstUnusedIdx / 9);
                                stampFirstIdx = currentPageIdx * 9;
                                stampLastIdx = Math.min(stampFirstIdx + 9, length);
                                // Prepare the stamps display
                                app.updateStampsContainer(app.doms.pageStamps.find(".stamps-container:eq(0)"));
                                // transition
                                $.mobile.changePage(app.doms.pageStamps, {
                                    transition: "slide"
                                });
                            });
                    });
                return false;
            });

            // Set the second stamps container to off screen at start up
            app.doms.pageStamps.eq(0).find(".stamps-container:eq(1)").css("left", "150%");

            // Handle swipe transitions between stamps container divs
            app.doms.pageStamps.find(".stampspage-content").on("swipeleft swiperight", function (event) {
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
            app.doms.containersStamps.on("tap", ".stamp", function (event) {
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
            app.doms.containersStamps.on("taphold", ".stamp", function () {
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.toggleClass("wobbly");
                stampDoms.find("> img.x-delete").toggleClass("hidden");
            });

            // Handle cancel button on stamps page
            app.doms.pageStamps.find("footer a:eq(0)").on("click", function () {
                currentStudent.total = currentStudent.saved_total;
                currentStudent.unused = currentStudent.saved_unused;
                currentStudent.data = JSON.parse(currentStudent.saved_data);
            });

            // Handle save button on stamps page
            app.doms.pageStamps.find("footer a:eq(1)").on("click", function () {
                $.mobile.loading("show");
                db.transaction(
                    function (tx) {
                        // update TeachRegLogs
                        $.each(stamps, function (idx, stamp) {
                            if (stamp.updated) {
                                if (stamp.log_id == -1) { // new stamp
                                    tx.executeSql("INSERT INTO TeachRegLogs (reg_id, use_time) VALUES (?, ?);",
                                        [stamp.reg_id, stamp.use_time]);
                                } else { // updated stamp
                                    tx.executeSql("UPDATE TeachRegLogs SET use_time = ? WHERE log_id = ?;",
                                        [stamp.use_time, stamp.log_id]);
                                }
                            }
                        });

                        // Delete any deleted logs
                        $.each(stampsDeleted, function (idx, stamp) {
                            if (stamp.log_id != -1) {
                                tx.executeSql("DELETE FROM TeachRegLogs WHERE log_id = ?;", [stamp.log_id]);
                            }
                        });

                        // Update total, unused summary
                        tx.executeSql(
                            "UPDATE TeachRegs SET total = ?, unused = ?, data = ? WHERE reg_id = ?;",
                            [currentStudent.total, currentStudent.unused, JSON.stringify(currentStudent.data), currentStudent.reg_id]
                        );
                    },
                    app.dbError,
                    function () {
                        var idxStudentList = students.indexOf(currentStudent);
                        app.doms.pageTeachRegs.find("ul a span").eq(idxStudentList).empty().text(currentStudent.unused);

                        $.mobile.changePage(app.doms.pageTeachRegs, {
                            transition: "pop",
                            reverse: true
                        });
                    }
                );
            });

            // Cancel wobbly when top up is about to show
            app.doms.pageStamps.find("header a[href='#topup-dialog']").on("click", function () {
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");
            });

            // Handle transition to student details page
            $("#student-details-button").on("click", function () {
                var li0 = app.doms.pageStudentDetails.find(".ui-content li:eq(0)");
                li0.find("h2").text(currentStudent.name);
                li0.find("p").text("from " + currentStudent.ctime.split(" ")[0]);

                app.doms.listStudentHistory.empty();
                $("<li>").append($("<a>",
                    {href: "#", text: "Taken: " + (currentStudent.total - currentStudent.unused)})).
                    appendTo(app.doms.listStudentHistory);
                $("<li>", {"data-icon": "false"}).
                    append($("<a>", {href: "#", text: "Unused: " + currentStudent.unused})).
                    appendTo(app.doms.listStudentHistory);
                if (app.doms.listStudentHistory.data("mobile-listview")) {
                    app.doms.listStudentHistory.listview("refresh");
                } else {
                    app.doms.listStudentHistory.listview();
                }

                app.doms.listStudentDaytime.empty();
                console.log(currentStudent.data.daytime);
                $.each(currentStudent.data["daytime"], function (idx, daytime) {
                    $("<li>").append($("<a>", {href: "#", text: daytime})).
                        append($("<a>", {href: "#", text: "delete"})).
                        appendTo(app.doms.listStudentDaytime);
                });
                if (app.doms.listStudentDaytime.data("mobile-listview")) {
                    app.doms.listStudentDaytime.listview("refresh");
                } else {
                    app.doms.listStudentDaytime.listview();
                }

                $.mobile.changePage(app.doms.pageStudentDetails, {
                    transition: "flip"
                });
                return false;
            });

            // handle student deletion
            $("#student-delete-button").on("click", function () {
                navigator.notification.confirm("The operation is not reversible!", function (btnIdx) {
                    if (btnIdx == 1) {
                        db.transaction(
                            function (tx) {
                                currentTeach.nregs -= 1;
                                tx.executeSql(
                                    "DELETE FROM TeachRegs WHERE reg_id = ?;",
                                    [currentStudent.reg_id]
                                );
                                tx.executeSql(
                                    "UPDATE Teaches SET nregs = ? WHERE teach_id = ?;",
                                    [currentTeach.nregs, currentTeach.teach_id]
                                );
                                tx.executeSql(
                                    "DELETE FROM TeachRegLogs WHERE reg_id = ?;",
                                    [currentStudent.reg_id]
                                );
                            },
                            app.dbError,
                            function () {
                                app.listStudentsForTeach(currentTeach.teach_id);
                                $.mobile.changePage(app.doms.pageTeachRegs, {
                                    transition: "pop",
                                    reverse: true
                                });
                                var idxTeachList = teaches.indexOf(currentTeach);
                                app.doms.divsHomeContent.eq(homeNavIdx).find("ul a span").eq(idxTeachList).empty().text(currentTeach.nregs);
                            }
                        );
                    }
                }, "Delete student?");
            });

            // Handle OK button on Top up dialog
            $("#topup-dialog").find("a:eq(1)").on("click", function () {
                var $this = $(this);
                var slider = $this.closest("form").find("input");
                var value = parseInt(slider.val());
                // Top up
                for (var i = 0; i < value; i++) {
                    stamps.push({
                        updated: true,
                        log_id: -1,
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

        finishHomeNav: function () {
            var activeContentDiv = app.doms.divsHomeContent.eq(homeNavIdx);
            app.doms.divsHomeContent.hide();
            activeContentDiv.show();
            $.mobile.loading("hide");
        },

        prepareTeaches: function () {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches ORDER BY teach_id;",
                        undefined,
                        function (tx, result) {
                            teaches = [];
                            for (var i = 0; i < result.rows.length; i++) {
                                var row = result.rows.item(i);
                                teaches.push({
                                    teach_id: row.teach_id,
                                    name: row.name,
                                    desc: row.desc,
                                    nregs: row.nregs,
                                    is_active: row.is_active,
                                    ctime: row.ctime,
                                    data: row.data
                                });
                            }
                            app.doms.listTeaches.empty();
                            $.each(teaches, function (idx, teach) {
                                var a = $("<a>", {
                                    "href": "#",
                                    text: teach.name
                                });
                                a.append($("<span>", {
                                    class: "ui-li-count ui-btn-up-c ui-btn-corner-all",
                                    text: teach.nregs
                                }));
                                app.doms.listTeaches.append($("<li>").append(a));
                            });
                            app.doms.listTeaches.listview("refresh");
                            app.finishHomeNav();
                        },
                        app.dbError)
                }
            );
        },

        prepareTeachRegs: function (teach_id) {
            db.transaction(
                function (tx) {
                    tx.executeSql("SELECT * FROM Teaches WHERE teach_id = ?;",
                        [teach_id],
                        function (tx, result) {
                            var row = result.rows.item(0);
                            app.doms.pageTeachRegs.data("teach_id", teach_id);
                            app.doms.pageTeachRegs.data("desc", row.desc);
                            app.doms.pageTeachRegs.find("header h1").text(row.name);
                            app.listStudentsForTeach(teach_id);
                        })
                }
            );
        },

        listStudentsForTeach: function (teach_id) {
            db.transaction(function (tx) {
                tx.executeSql(
                    "SELECT * FROM TeachRegs WHERE teach_id = ? ORDER BY upper(user_fname || user_lname);",
                    [teach_id],
                    function (tx, result) {
                        students = [];
                        for (var i = 0; i < result.rows.length; i++) {
                            var row = result.rows.item(i);
                            students.push({
                                teach_id: row.teach_id,
                                reg_id: row.reg_id,
                                user_id: row.user_id,
                                fname: row.user_fname,
                                lname: row.user_lname,
                                name: (row.user_lname != "") ? row.user_fname + " " + row.user_lname : row.user_fname,
                                total: row.total,
                                unused: row.unused,
                                is_active: row.is_active,
                                ctime: row.ctime,
                                data: JSON.parse(row.data)
                            });
                        }
                        var ul = $("#student-list");
                        ul.empty();
                        $.each(students, function (idx, student) {
                            var a = $("<a>", {
                                href: "#",
                                text: student.name
                            });

                            a.append($("<span>", {
                                "class": "ui-li-count ui-btn-up-c ui-btn-corner-all",
                                text: student.unused
                            }));
                            ul.append($("<li>").append(a));
                        });
                        ul.listview("refresh");
                    },
                    app.dbError
                );
            });
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

            return now.getFullYear() + '-' + mon + '-' + date + ' ' + hour + ':' + min + ':' + sec;
        },

        parseClassDaytime: function (daytime) {
            var fields = daytime.split(" ");
            var day = fields[0],
                hourmin = fields[1].split(":"),
                hour = hourmin[0],
                min = hourmin[1],
                ampm = fields[2];
            return [days.indexOf(day), parseInt(hour) - 1, parseInt(min), periods.indexOf(ampm)];
        },

        vectorIsIdentical: function (a, b) {
            var i = a.length;
            if (i != b.length) return false;
            while (i--) {
                if (a[i] !== b[i]) return false;
            }
            return true;
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
                        "key VARCHAR PRIMARY KEY NOT NULL , " +
                        "val TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Teaches (" +
                        "teach_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "name VARCHAR NOT NULL, " +
                        "desc TEXT, " +
                        "nregs INTEGER NOT NULL DEFAULT 0, " + // number of registered students
                        "is_active BOOL NOT NULL DEFAULT 1 ," +
                        "ctime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ," +
                        "data TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegs (" +
                        "teach_id INTEGER NOT NULL , " +
                        "reg_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                        "user_id INTEGER, " +
                        "user_fname VARCHAR, " +
                        "user_lname VARCHAR, " +
                        "total INTEGER NOT NULL DEFAULT 0, " +
                        "unused INTEGER NOT NULL DEFAULT 0, " +
                        "is_active BOOL NOT NULL DEFAULT 1, " +
                        "ctime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS TeachRegLogs (" +
                        "reg_id INTEGER NOT NULL, " +
                        "log_id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL , " +
                        "use_time DATETIME, " +
                        "ctime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                        "data TEXT);");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS Learns (" +
                        "teacher_id INTEGER NOT NULL, " +
                        "teach_id INTEGER NOT NULL, " +
                        "teach_name VARCHAR NOT NULL, " +
                        "teach_desc TEXT, " +
                        "teacher_fname VARCHAR, " +
                        "teacher_lname VARCHAR, " +
                        "is_active BOOL NOT NULL DEFAULT 1, " +
                        "ctime DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                        "PRIMARY KEY (teacher_id, teach_id));");

                    tx.executeSql("CREATE TABLE IF NOT EXISTS ClassMsgs (" +
                        "msg_id INTEGER PRIMARY KEY NOT NULL, " +
                        "teacher_id INTEGER NOT NULL, " +
                        "teach_id INTEGER NOT NULL, " +
                        "sender_id INTEGER NOT NULL, " +
                        "sender_fname VARCHAR, " +
                        "sender_lname VARCHAR, " +
                        "title VARCHAR NOT NULL, " +
                        "body TEXT, " +
                        "ctime DATETIME NOT NULL, " +
                        "data TEXT);");

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
                            "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused, data) " +
                            "VALUES (1, 'Emma', 'Wang', 24, 14, '{\"daytime\":[\"Sunday 01:00 PM\"]}');");
                    tx.executeSql(
                            "INSERT INTO TeachRegs (teach_id, user_fname, user_lname, total, unused, data) " +
                            "VALUES (1, 'Tia', 'Wang', 5, 2, '{\"daytime\":[\"Monday 03:00 PM\"]}');");
                    for (var i = 0; i < 24; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(1);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE log_id < 11;");
                    for (i = 0; i < 5; i++) {
                        tx.executeSql("INSERT INTO TeachRegLogs (reg_id) VALUES(2);");
                    }
                    tx.executeSql("UPDATE TeachRegLogs SET use_time = '2014-06-05' WHERE log_id IN (25, 26, 27);");
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
        homeNavIdx = -1; // force reload on teach list page
        $("#icon-teach").trigger("click");
    });

})(jQuery);

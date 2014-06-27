(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var user = {};
    var teaches, currentTeach;
    var registrations, currentReg;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;

    var NEW_STAMP = -1;

    var lastAjaxCall;

    var homeNavIdx = -1;
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

            // This is to ensure the same ajax call does not fire twice
            lastAjaxCall = {};

            // Gets called before ajax call is sent
            $(document).ajaxSend(function (event, jqXhr, options) {
                $.mobile.loading('show');
            });

            // Always gets called when an ajax finishes regardless of success
            $(document).ajaxComplete(function (event, jqXhr, options) {
                if (lastAjaxCall.url == options.url && lastAjaxCall.type == options.type) {
                    lastAjaxCall = {};
                }
            });

            // This is always called when any ajax call is successfully return, unless
            // its global option is set to false
            $(document).ajaxSuccess(function (event, jqXhr, options, data) {
                //console.log(event);
                //console.log(jqXhr);
                //console.log(options);
                console.log(data);
            });

            // Some always need ajax parameters
            $.ajaxSetup({
                type: "GET",
                dataType: "json",
                xhrFields: {
                    withCredentials: true
                },
                crossDomain: true,
                //headers: {"Cookie": "sessionid=6376m4cf23tr2lq8x5o4r36hztrjm925"},
                timeout: 9000
            });

            // Always attach json as a parameter to request for json data
            $.ajaxPrefilter(function (options, originalOptions, jqXhr) {
                // Ensure the same ajax call does not fire twice in a row
                if (lastAjaxCall.url == options.url && lastAjaxCall.type == options.type) {
                    console.log('Aborting duplicate ajax call ...');
                    jqXhr.abort();
                } else {
                    lastAjaxCall.url = options.url;
                    lastAjaxCall.type = options.type;
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
                            app.showTeachLessons();
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
            var savedUser = localStorage.getItem('user');
            if (savedUser) {
                user = JSON.parse(savedUser);
                $.mobile.changePage(app.doms.pageHome);
                $("#icon-teach").trigger("click");
            }

            $("#login-btn").on("click", function () {
                var loginPanel = $("#login-panel"),
                    form = loginPanel.find("form"),
                    loginFeedback = $("#login-feedback span");
                $.ajax({
                    type: "POST",
                    url: server_url + "j/login/",
                    data: form.serialize()
                })
                    .done(function (data) {
                        if (QERR in data) {
                            loginFeedback.empty().text(data[QERR]);
                        } else {
                            user = data;
                            localStorage.setItem('user', JSON.stringify(user));
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "slideup"
                            });
                            $("#icon-teach").trigger("click");
                            loginFeedback.empty();
                            form[0].reset();
                        }
                    })
                    .fail(app.ajax_error_handler);
            });

            $("#logout-btn").on("click", function () {
                $.ajax({
                    type: "POST",
                    url: server_url + "j/logout/",
                    data: ""
                })
                    .always(function (data) {
                        user = {};
                        localStorage.removeItem('user');
                        $.mobile.changePage(app.doms.pageLogin, {
                            transition: "slidedown"
                        });
                    })
                    .fail(app.ajax_error_handler);
            });

            $("#register-btn").on("click", function () {
                var registerPanel = $("#register-panel"),
                    form = registerPanel.find("form"),
                    formData = form.serializeArray(),
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
                        url: server_url + "j/register/",
                        data: data
                    })
                        .done(function (data) {
                            if (QERR in data) {
                                if ("username" in data.err) {
                                    form.find("label:eq(0) span").text(data.err["username"]);
                                }
                            } else {
                                user = data;
                                $.mobile.changePage(app.doms.pageHome, {
                                    transition: "slideup"
                                });
                                $("#icon-teach").trigger("click");
                                form.find("label span").empty();
                                form[0].reset();
                            }
                        })
                        .fail(app.ajax_error_handler);
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
                    fields = {};
                $.each(form.serializeArray(), function (idx, field) {
                    fields[field.name] = $.trim(field.value);
                });
                // Must have name for the new teach class
                if (fields['name'] == '') {
                    app.alert('Class name is required.', undefined, 'Invalid Input');
                } else {
                    $.ajax({
                        type: 'POST',
                        url: server_url + 'j/update_lesson/',
                        // headers: {'mobile-app': ''},
                        // do not set content-type so options request can be skipped
                        data: JSON.stringify({'create': fields})
                    })
                        .done(function (data) {
                            form[0].reset();
                            app.showTeachLessons();
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "pop",
                                reverse: true
                            });
                        })
                        .fail(app.ajax_error_handler);
                }
            });

            // Handle click on teach list
            app.doms.listTeaches.on("click", "a", function () {
                var $this = $(this);
                currentTeach = teaches[$this.parent().prevAll().length];
                app.doms.pageTeachRegs.find("header h1").text(currentTeach.name);
                app.showRegsForTeachLesson();
            });

            // Handle details button on teach regs page
            $("#teach-details-button").on("click", function () {
                var li0 = app.doms.pageTeachRegsDetails.find(".ui-content li:eq(0)");
                li0.find("h2").text(currentTeach.name);
                li0.find("p:eq(0)").text(currentTeach.description);
                li0.find("p:eq(1)").text("Created: " + currentTeach.creation_time.split(" ")[0]);
                $.mobile.changePage(app.doms.pageTeachRegsDetails, {
                    transition: "flip"
                });
                return false;
            });

            // fill the current teach details for popup
            app.doms.pageTeachRegsDetails.on("pageshow", function () {
                var popup0 = $("#teach-edit-popup-0");
                popup0.find("input").val(currentTeach.name);
                popup0.find("textarea").val(currentTeach.description);
            });

            // Handle save on popup window of the teach details page
            $("#teach-edit-popup-0").find("a:eq(1)").on("click", function () {
                var popup0 = $("#teach-edit-popup-0"),
                    name = popup0.find("input").val();
                if (name == '') {
                    app.alert('Class name is required.', undefined, 'Invalid Input');
                } else {
                    currentTeach.name = name;
                    currentTeach.description = popup0.find("textarea").val();
                    $.ajax({
                        type: 'POST',
                        url: server_url + 'j/update_lesson/',
                        data: JSON.stringify({'update': {
                            'name': currentTeach.name,
                            'description': currentTeach.description,
                            'lesson_id': currentTeach.lesson_id}})
                    })
                        .done(function (data) {
                            if (QERR in data) {
                                console.log(data[QERR]);
                            } else {
                                var li0 = app.doms.pageTeachRegsDetails.find(".ui-content li:eq(0)");
                                li0.find("h2").text(currentTeach.name);
                                li0.find("p:eq(0)").text(currentTeach.description);
                                app.doms.pageTeachRegs.find("header h1").text(currentTeach.name);
                                var idxTeachList = teaches.indexOf(currentTeach);
                                app.doms.divsHomeContent.eq(homeNavIdx).find("ul a").eq(idxTeachList)
                                    .get(0).firstChild.nodeValue = currentTeach.name;
                            }
                        })
                        .fail(app.ajax_error_handler);
                }
            });

            // Handle teach delete button
            $("#teach-delete-button").on("click", function () {
                app.confirm('The operation is not reversible!',
                    function (btnIdx) {
                        if (btnIdx == 1) {
                            $.ajax({
                                type: 'POST',
                                url: server_url + 'j/update_lesson/',
                                data: JSON.stringify({'delete': {'lesson_id': currentTeach.lesson_id}})
                            })
                                .done(function (data) {
                                    if (QERR in data) {
                                        console.log(data[QERR]);
                                    } else {
                                        homeNavIdx = -1; // force reload on teach list page
                                        $("#icon-teach").trigger("click");
                                        $.mobile.changePage(app.doms.pageHome, {
                                            transition: "pop",
                                            reverse: true
                                        });
                                    }
                                })
                                .fail(app.ajax_error_handler);
                        }
                    }, 'Delete class?');
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
            // It modifies the currentReg object if data is changed
            // the object is later persistent into the database if save button
            // is clicked on the stamps page.
            app.doms.pageStudentDetails.find("header a").on("click", function () {
                var daytimeList = [];
                $.each($(this).closest("section").find(".daytime-list li a:not([title='delete'])"),
                    function (idx, dom) {
                        daytimeList.push(dom.innerHTML);
                    });
                var data = JSON.parse(currentReg.data);
                data.daytime = daytimeList;
                currentReg.data = JSON.stringify(data);
            });

            // Handle Save button for new student page
            app.doms.pageNewStudent.find("footer a:eq(1)").click(function () {
                var form = $("#new-student-form"),
                    fields = {};
                $.each(form.serializeArray(), function (idx, field) {
                    fields[field.name] = $.trim(field.value);
                });

                if (fields['first_name'] == '' || fields['last_name'] == '') {
                    app.alert('Name is required', undefined, 'Invalid Input')
                } else {
                    fields['lesson_id'] = currentTeach.lesson_id;
                    // add any class daytime entries
                    var data = {daytime: []};
                    $.each(app.doms.listNewStudentDaytime.find("li a:not([title='delete'])"),
                        function (idx, dom) {
                            data.daytime.push(dom.innerHTML);
                        });
                    fields['data'] = (JSON.stringify(data));
                    $.ajax({
                        type: 'POST',
                        url: server_url + 'j/update_lesson_reg_and_logs/',
                        data: JSON.stringify({'create': fields})
                    })
                        .done(function (data) {
                            if (QERR in data) {
                                console.log(data[QERR]);
                            } else {
                                app.showRegsForTeachLesson();
                                $.mobile.changePage(app.doms.pageTeachRegs, {
                                    transition: "slideup"
                                });
                                form[0].reset();
                                app.doms.listNewStudentDaytime.empty();
                                currentTeach.nregs += 1;
                                var idxTeachList = teaches.indexOf(currentTeach);
                                app.doms.divsHomeContent.eq(homeNavIdx).
                                    find("ul a span").
                                    eq(idxTeachList).empty().text(currentTeach.nregs);
                            }
                        })
                        .fail(app.ajax_error_handler);
                }
            });

            // Handle the transition from teach regs page to stamps page
            app.doms.listStudents.on("click", "a", function () {
                var $this = $(this);
                currentReg = registrations[$this.parent().prevAll(":not(.ui-li-divider)").length];
                // Save the start values in case the operations are cancelled
                currentReg.saved_total = currentReg.total;
                currentReg.saved_unused = currentReg.unused;
                currentReg.saved_data = currentReg.data;
                app.doms.pageStamps.find("header h1").text(app.get_student_display_name(currentReg));

                // No wobbly or delete badge when the stamps page is transitioned
                // from teach regs page
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");

                $.ajax({
                    url: server_url + 'j/get_lesson_reg_logs/' + currentReg.reg_id + '/'
                })
                    .done(function (data) {
                        stamps = data;
                        var length = stamps.length;
                        // pre-set to last idx in case no unused slot is available
                        var firstUnusedIdx = length == 0 ? 0 : length - 1;
                        stampsDeleted = [];
                        for (var i = 0; i < length; i++) {
                            var stamp = stamps[i];
                            if (!stamp.use_time && i < firstUnusedIdx) {
                                firstUnusedIdx = i;
                            }
                            stamp.updated = false;
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
                    })
                    .fail(app.ajax_error_handler);
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
                        currentReg.total -= 1;
                        if (stamp.use_time == null) {
                            currentReg.unused -= 1;
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
                            currentReg.unused += 1;
                        } else {
                            stamp.use_time = app.getCurrentTimestamp();
                            currentReg.unused -= 1;
                        }
                        // update the unused count display
                        page.find(".unusedCount").empty().text(currentReg.unused);
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
                currentReg.total = currentReg.saved_total;
                currentReg.unused = currentReg.saved_unused;
                currentReg.data = currentReg.saved_data;
            });

            // Handle save button on stamps page
            app.doms.pageStamps.find("footer a:eq(1)").on("click", function () {
                var rlogs = {create: [], update: [], delete: []};
                $.each(stamps, function (idx, stamp) {
                    if (stamp.updated) {
                        var entry = {use_time: stamp.use_time, data: JSON.stringify(stamp.data)};
                        console.log(entry);
                        if (stamp.rlog_id == NEW_STAMP) {
                            rlogs.create.push(entry);
                            console.log(rlogs.create);
                        } else {
                            rlogs.update.push($.extend(entry, {rlog_id: stamp.rlog_id}));
                        }
                    }
                });
                $.each(stampsDeleted, function (idx, stamp) {
                    if (stamp.rlog_id != NEW_STAMP) {
                        rlogs.delete.push({rlog_id: stamp.rlog_id});
                    }
                });
                $.ajax({
                    type: 'POST',
                    url: server_url + 'j/update_lesson_reg_and_logs/',
                    data: JSON.stringify({
                        'update': {
                            reg_id: currentReg.reg_id,
                            data: currentReg.data,
                            'rlogs': rlogs
                        }})
                })
                    .done(function () {
                        var idxStudentList = registrations.indexOf(currentReg);
                        app.doms.pageTeachRegs.find("ul a span").
                            eq(idxStudentList).empty().text(currentReg.unused);
                        $.mobile.changePage(app.doms.pageTeachRegs, {
                            transition: "pop",
                            reverse: true
                        });
                    })
                    .fail(app.ajax_error_handler);
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
                li0.find("h2").text(app.get_student_display_name(currentReg));
                li0.find("p").text("from " + currentReg.creation_time.split(" ")[0]);

                app.doms.listStudentHistory.empty();
                $("<li>").append($("<a>",
                    {href: "#", text: "Taken: " + (currentReg.total - currentReg.unused)})).
                    appendTo(app.doms.listStudentHistory);
                $("<li>", {"data-icon": "false"}).
                    append($("<a>", {href: "#", text: "Unused: " + currentReg.unused})).
                    appendTo(app.doms.listStudentHistory);
                app.refresh_listview(app.doms.listStudentHistory);

                app.doms.listStudentDaytime.empty();
                console.log(currentReg);
                var daytimeList = JSON.parse(currentReg.data).daytime || [];
                $.each(daytimeList, function (idx, daytime) {
                    $("<li>").append($("<a>", {href: "#", text: daytime})).
                        append($("<a>", {href: "#", text: "delete"})).
                        appendTo(app.doms.listStudentDaytime);
                });
                app.refresh_listview(app.doms.listStudentDaytime);

                $.mobile.changePage(app.doms.pageStudentDetails, {
                    transition: "flip"
                });
                return false;
            });

            // handle student deletion
            $("#student-delete-button").on("click", function () {
                app.confirm('The operation is not reversible!',
                    function (btnIdx) {
                        if (btnIdx == 1) {
                            $.ajax({
                                type: 'POST',
                                url: server_url + 'j/update_lesson_reg_and_logs/',
                                data: JSON.stringify({delete: {reg_id: currentReg.reg_id}})
                            })
                                .done(function (data) {
                                    if (QERR in data) {
                                        console.log(data);
                                    } else {
                                        app.showRegsForTeachLesson();
                                        $.mobile.changePage(app.doms.pageTeachRegs, {
                                            transition: "pop",
                                            reverse: true
                                        });
                                        var idxTeachList = teaches.indexOf(currentTeach);
                                        currentTeach.nregs -= 1;
                                        app.doms.divsHomeContent.eq(homeNavIdx).find("ul a span").
                                            eq(idxTeachList).empty().text(currentTeach.nregs);
                                    }
                                })
                                .fail(app.ajax_error_handler);
                        }
                    }, 'Delete student?');
                return false;
            });

            // Handle OK button on Topup dialog
            $("#topup-dialog").find("a:eq(1)").on("click", function () {
                var $this = $(this);
                var slider = $this.closest("form").find("input");
                var value = parseInt(slider.val());
                // Top up
                for (var i = 0; i < value; i++) {
                    stamps.push({
                        updated: true,
                        rlog_id: NEW_STAMP,
                        reg_id: currentReg.reg_id,
                        use_time: null,
                        creation_time: app.getCurrentTimestamp(),
                        data: null
                    });
                }
                var page = $this.closest("section");
                currentReg.unused += value;
                currentReg.total += value;
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

        showTeachLessons: function () {
            $.ajax({
                url: server_url + 'j/get_teach_lessons/' + user.user_id + '/'
            })
                .done(function (data) {
                    teaches = data;
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
                })
                .fail(app.ajax_error_handler);
        },

        showRegsForTeachLesson: function () {
            $.ajax({
                url: server_url + 'j/get_lesson_regs/' + currentTeach.lesson_id + '/'
            })
                .done(function (data) {
                    registrations = data;
                    app.doms.listStudents.empty();
                    $.each(registrations, function (idx, registration) {
                        var a = $("<a>", {
                            href: "#",
                            text: app.get_student_display_name(registration)
                        });
                        a.append($("<span>", {
                            "class": "ui-li-count ui-btn-up-c ui-btn-corner-all",
                            text: registration.unused
                        }));
                        app.doms.listStudents.append($("<li>").append(a));
                    });
                    app.refresh_listview(app.doms.listStudents);
                    $.mobile.changePage(app.doms.pageTeachRegs, {
                        transition: "slide"
                    });
                    $.mobile.loading('hide');
                })
                .fail(app.ajax_error_handler);
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
            page.find(".unusedCount").empty().text(currentReg.unused);
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

        get_student_display_name: function (registration) {
            if (registration.student) {
                var student = registration.student,
                    name = [student.first_name, student.last_name].join(' ');
                return name != '' ? name : student.username;
            } else {
                return [registration.student_first_name, registration.student_last_name].join(' ');
            }
        },

        refresh_listview: function (ul) {
            if (ul.data("mobile-listview")) {
                ul.listview("refresh");
            } else {
                ul.listview();
            }
        },

        alert: function (message, callback, title) {
            navigator.notification.alert(message, callback, title);
            console.log(message);
        },

        confirm: function (message, callback, title) {
            console.log(navigator.notification);
            navigator.notification.confirm(message, callback, title);
        },

        ajax_error_handler: function (jqXHR, textStatus, errorThrown) {
            // hide any possible still showing ajax loader
            $.mobile.loading('hide');
            if (textStatus != 'canceled') {
                console.log('AJAX call failed: ' + textStatus);
                console.log(jqXHR);
            }
        }
    };

    app.initialize();

    $("#popdb").click(function () {
        console.log("Reset DB");
        $.ajax({
            type: 'POST',
            url: server_url + 'debug_reset_db/',
            dataType: "text"
        })
            .done(function () {
                homeNavIdx = -1;  // force reload on teach list page
                $("#icon-teach").trigger("click");
            })
            .fail(app.ajax_error_handler);
    });

})(jQuery);

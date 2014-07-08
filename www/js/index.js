(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var me = {};
    var messages;
    var teaches, currentTeach;
    var studies, currentStudy;
    var registrations, currentReg;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;

    var currentUser, currentLesson,  // These are the user and lesson to be shown for variable details page
        currentRequest;

    var userSearchHitLink;

    var NEW_STAMP = -1;

    var REQUEST_ENROLL = 1,
        REQUEST_JOIN = 2,
        REQUEST_DEROLL = 3,
        REQUEST_QUIT = 4,
        REQUEST_ENROLL_ACCEPTED = 201,
        REQUEST_ENROLL_REJECTED = 202,
        REQUEST_JOIN_ACCEPTED = 203,
        REQUEST_JOIN_REJECTED = 204;

    // Throttle ajax request so request to same url is only fired once every
    // throttle interval value
    var ajaxThrottle, throttleInterval = 300; // ms
    var delay = (function () {
        var timer = 0;
        return function (callback, ms) {
            clearTimeout(timer);
            timer = setTimeout(callback, ms);
        };
    })();

    var homeNavIdx = -1;
    var weekdays = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday"],
        periods = ["AM", "PM"];

    var re_email = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

    var server_url = "http://levelhub-ywangd.rhcloud.com/";
    server_url = "http://localhost:8000/";
    if (window.location.hostname != "localhost") {
        //server_url = "http://levelhub-ywangd.rhcloud.com/";
    }
    //server_url = "http://10.0.2.2:8000/";
    //server_url = "http://192.168.1.16:8000/";

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).on("deviceready", app.onDeviceReady);
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
            ajaxThrottle = {};

            // Gets called before ajax call is sent
            $(document).ajaxSend(function (event, jqXhr, options) {
                $.mobile.loading("show");
            });

            // Always gets called when an ajax finishes regardless of success
            $(document).ajaxComplete(function (event, jqXhr, options) {
                $.mobile.loading("hide")
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

            // Throttle ajax GET requests. So the request to the same URL + parameters
            // only happens every throttleInterval interval
            $.ajaxPrefilter(function (options, originalOptions, jqXhr) {
                if (options.type == "GET") {
                    var fullPath = options.url + "?" + options.data;
                    console.log(fullPath);
                    // Ensure the same ajax call does not fire twice in a row
                    if (ajaxThrottle[fullPath] && (Date.now() - ajaxThrottle[fullPath]) < throttleInterval) {
                        console.log('Aborting duplicate ajax call ', fullPath);
                        jqXhr.abort();
                    } else {
                        ajaxThrottle[fullPath] = Date.now();
                    }
                }
            });

            // All pages and parts
            app.doms = {
                pageLogin: $("#login"),
                pageRegister: $("#register"),
                pageHome: $("#home"),
                pageNewMessage: $("#new-message"),
                pageNewTeach: $("#new-teach"),
                pageTeachRegs: $("#teach-regs-page"),
                pageNewStudentOffline: $("#new-student-offline"),
                pageNewStudentOnline: $("#new-student-online"),
                pageStamps: $("#stamps-page"),
                pageTeachDetails: $("#teach-details-page"),
                pageRegistrationInfo: $("#registration-info-page"),
                headerHome: $("#home-header"),
                btnHomeUR: $("#home-btn-right"),
                listStudents: $("#student-list"),
                listTeaches: $("#teach-list"),
                listStudies: $("#study-list")
            };

            app.doms.divsHomeContent = app.doms.pageHome.find(".ui-content");
            app.doms.containersStamps = app.doms.pageStamps.find(".stamps-container");

            // initialize the global daytime picker
            // Pickerize the control only if they have not been pickerized
            if ($("#uipv_main_class-day").length == 0) {
                var popup = $("#daytime-dialog"),
                    popupContainer = $("#daytime-dialog-popup");
                popup.enhanceWithin().popup();
                var selects = popup.find("select");
                // Set proper dimension of the popup
                var fontSize = app.doms.pageLogin.css("font-size"),
                    totalWidth = app.doms.pageLogin.width(), // window.innerWidth,
                    width = totalWidth * 0.9 / 5;
                popup.css("width", width * 5 + "px");
                popupContainer.css("left", (totalWidth * 0.1 / 2) + "px");
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

            // Support swiperight to go back previous page
            $("section").not(app.doms.pageLogin).not(app.doms.pageHome).not(app.doms.pageRegister).not(app.doms.pageStamps)
                .on("swiperight", function () {
                    history.back();
                });

            // home page init
            // Handle home nav icon press
            app.doms.pageHome.on("click", "#icon-news, #icon-teach, #icon-study, #icon-more", function () {
                var $this = $(this);
                var idx = $this.parent().prevAll().length;
                homeNavIdx = idx;
                // Still need to manually manage classes to make highlight button persistent
                $this.parent().siblings().find("a").removeClass("ui-btn-active ui-state-persist");
                $this.addClass("ui-btn-active ui-state-persist");

                switch (app.doms.divsHomeContent.eq(idx).attr("id")) {
                    case "news":
                        app.doms.headerHome.find("h1").text("Recent News");
                        app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                            .addClass("ui-icon-plus")
                            .attr({
                                "href": "#new-message",
                                "data-transition": "slide"
                            }).show();
                        app.showMessages();
                        break;
                    case "teach":
                        app.doms.headerHome.find("h1").text("My Teachings");
                        app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                            .addClass("ui-icon-plus")
                            .attr({
                                "href": "#new-teach",
                                "data-transition": "slide"
                            }).show();
                        app.showTeachLessons(me, app.doms.listTeaches);
                        break;
                    case "study":
                        app.doms.headerHome.find("h1").text("My Learnings");
                        app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                            .addClass("ui-icon-plus")
                            .attr({
                                "href": "#new-study-guide",
                                "data-transition": "slide"
                            }).show();
                        app.showStudyLessons();
                        break;
                    case "more":
                        app.doms.headerHome.find("h1").text("Settings");
                        app.doms.btnHomeUR.hide();
                        app.showSetup();
                        break;
                }
                app.doms.divsHomeContent.hide().eq(homeNavIdx).show();
                return false;
            });

            // make sure the settings are displayed correctly based on their values
            if (localStorage.getItem("homeContent")) {
                var radios = $("#settings-first-page input:radio");
                radios.checkboxradio();
                radios.filter("[value=" + localStorage.getItem("homeContent") + "]").attr("checked", true);
                radios.checkboxradio("refresh");
            } else {
                localStorage.setItem("homeContent", $("#settings-first-page input:radio:checked").val());
            }

            // The first page to show
            var savedMe = localStorage.getItem('me');
            if (savedMe) {
                me = JSON.parse(savedMe);
                app.getUserLessons(function (data) {
                        data = app.process_pulse(data);
                        teaches = data.teach;
                        studies = data.study;
                        $.mobile.changePage(app.doms.pageHome);
                        $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
                    },
                    "all");
            }

            // Handle changes on first page settings
            $("#settings-first-page").on("click", "label", function () {
                localStorage.setItem("homeContent", $(this).next("input").val());
            });

            // Login
            $("#login-btn").on("click", function () {
                var loginPanel = $("#login-panel"),
                    form = loginPanel.find("form"),
                    data = form.serialize();

                $.ajax({
                    type: "POST",
                    url: server_url + "j/login/",
                    data: data
                })
                    .done(function (data) {
                        me = app.process_pulse(data);
                        localStorage.setItem('me', JSON.stringify(me));
                        app.getUserLessons(function (data) {
                                data = app.process_pulse(data);
                                teaches = data.teach;
                                studies = data.study;
                                $.mobile.changePage(app.doms.pageHome, {
                                    transition: "slideup"
                                });
                                $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
                                form[0].reset();
                            },
                            "all");
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Logout
            $("#logout-btn").on("click", function () {
                $.ajax({
                    type: "POST",
                    url: server_url + "j/logout/",
                    data: ""
                })
                    .always(function (data) {
                        me = {};
                        localStorage.removeItem('me');
                        $.mobile.changePage(app.doms.pageLogin, {
                            transition: "slidedown"
                        });
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Register
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
                            me = app.process_pulse(data);
                            teaches = [];
                            studies = [];
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "slideup"
                            });
                            $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
                            form.find("label span").empty();
                            form[0].reset();
                        })
                        .fail(app.ajaxErrorHandler);
                }
            });


            var recipientSelection = $("#recipient-selection"),
                lessonGroups = $("#lesson-groups"),
                individualLesson = $("#individual-lesson"),
                recipientButton = $("#choose-recipients");

            // When recipient button is clicked, toggle the recipient selection box
            // Also change the direction of carat to indicate expand or collapse
            recipientButton.on("click", function () {
                var $this = $(this);
                recipientSelection.toggle();
                $this.toggleClass("ui-icon-carat-d ui-icon-carat-u");
            });

            // populate recipient list based on user lessons
            app.doms.pageNewMessage.on("pagebeforeshow", function () {

                lessonGroups.empty();
                individualLesson.empty();
                recipientButton.text("Choose recipients ...");
                if (teaches.length > 0 || studies.length > 0) {
                    lessonGroups.append($('<input type="radio" name="recipient-radio" id="recipient-radio-0" value="0"/><label for="recipient-radio-0">All lessons</label>'));

                    if (teaches.length > 0) {
                        lessonGroups.append($('<input type="radio" name="recipient-radio" id="recipient-radio-1" value="1"/><label for="recipient-radio-1">All teachings</label>'));
                    }
                    if (studies.length > 0) {
                        lessonGroups.append($('<input type="radio" name="recipient-radio" id="recipient-radio-2" value="2"/><label for="recipient-radio-2">All learnings</label>'));
                    }
                    lessonGroups.append($('<input type="radio" name="recipient-radio" id="recipient-radio-3" value="3"/><label for="recipient-radio-3">Individual lesson</label>'));

                    $.each(teaches.concat(studies), function (idx, lesson) {
                        var theid = "recipient-check-" + idx;
                        $('<input type="checkbox" class="custom"/>').attr({name: theid, id: theid}).appendTo(individualLesson);
                        $('<label/>').attr({for: theid}).text(lesson.name).data("lesson_id", lesson.lesson_id).appendTo(individualLesson);
                    });
                }
                lessonGroups.find("input").checkboxradio();
                individualLesson.find("input").checkboxradio();

                // Change text on the recipient button accordingly based on the selection
                // of recipients. The selection can be a radio or checkbox input.
                // The first three radio inputs are simple (just display their values).
                // The last radio input is for opening the individual lesson selection.
                // The checkbox can not be processed using the click event, because their
                // values are changed after the click event. Thus the value is incorrect
                // when inside the click handler. The following "change" handler is used
                // to handle the checkbox changes.
                lessonGroups.find('[type="radio"]').on("click", function () {
                    var $this = $(this);
                    if ($this.attr("id") != "recipient-radio-3") {
                        individualLesson.hide();
                        recipientButton.text($this.prev("label").text());
                    } else {
                        individualLesson.show().find("input:eq(0)").trigger("change");
                    }
                });

                individualLesson.find("input").on("change", function () {
                    var checkBoxes = individualLesson.find("input");
                    var texts = [];
                    for (var i = 0; i < checkBoxes.length; i++) {
                        if (checkBoxes.eq(i).is(":checked")) {
                            texts.push(checkBoxes.eq(i).prev("label").text());
                        }
                    }
                    if (texts.length > 0) {
                        recipientButton.text(texts.join(","));
                    } else {
                        recipientButton.text("Choose recipients ...");
                    }
                });

                recipientSelection.hide();
                individualLesson.hide();
            });


            // Send button on new message page
            app.doms.pageNewMessage.find("footer a:eq(1)").on("click", function () {

                var lesson_ids = [],
                    labelRadio = lessonGroups.find("label.ui-radio-on").attr("for");
                if (labelRadio != "recipient-radio-3") {
                    if (labelRadio == "recipient-radio-0" || labelRadio == "recipient-radio-1") {
                        $.each(teaches, function (idx, teach) {
                            lesson_ids.push(teach.lesson_id);
                        });
                    }
                    if (labelRadio == "recipient-radio-0" || labelRadio == "recipient-radio-2") {
                        $.each(studies, function (idx, study) {
                            lesson_ids.push(study.lesson_id);
                        });
                    }
                } else {
                    $.each(individualLesson.find("label.ui-checkbox-on"), function (idx, label) {
                        lesson_ids.push($(label).data("lesson_id"));
                    });
                }
                var body = $.trim($("#lesson-message-body").val());
                if (lesson_ids.length == 0) {
                    app.ajaxErrorAlert("Message has no recipient");
                    return false;
                }
                if (body.length == 0) {
                    app.ajaxErrorAlert("Message cannot be empty");
                    return false;
                }
                $.ajax({
                    type: "POST",
                    url: server_url + "j/process_lesson_messages/",
                    data: JSON.stringify({action: "create", body: body, lesson_ids: lesson_ids})
                })
                    .done(function (data) {
                        app.process_pulse(data);
                        app.showMessages();
                        history.back();
                        $("#lesson-message-body").closest("form")[0].reset();
                    })
                    .fail(app.ajaxErrorHandler);

                return false;
            });

            // The user search button can be in different page.
            // Hence the search hits point to different links.
            $(".user-search-btn").on("click", function () {
                switch ($(this).closest("section").attr("id")) {
                    case "new-student-guide":
                        userSearchHitLink = "#new-student-online";
                        break;
                    case "new-study-guide":
                        userSearchHitLink = "#user-teaches-page";
                        break;
                }
            });

            // Handle continuous user search
            $("#user-search").on("keyup", "#user-search-input", function () {
                var $this = $(this);
                if ($this.val() == "") {
                    delay(function () {
                        $("#user-search-output").empty().listview("refresh");
                    }, 300);
                } else {
                    delay(function () {
                        $.ajax({
                            url: server_url + 'j/user_search',
                            data: {phrase: $this.val()}
                        })
                            .done(function (data) {
                                var users = app.process_pulse(data);
                                var ul = $("#user-search-output");
                                ul.empty();
                                $.each(users, function (idx, user) {
                                    $("<li>").append(
                                        $('<a data-transition="slide"></a>')
                                            .attr("href", userSearchHitLink)
                                            .text(app.getUserDisplayName(user))
                                            .data("user", user))
                                        .appendTo(ul);
                                });
                                ul.listview("refresh");
                            })
                            .fail(app.ajaxErrorHandler);
                    }, 300);
                }
            })
                .on("click", ".ui-input-clear", function () {
                    delay(function () {
                        $("#user-search-output").empty().listview("refresh");
                    }, 300);
                })
                .on("click", "#user-search-output a", function () {
                    currentUser = $(this).data("user");
                })
                .on("pagehide", function () {  // reset search page when it is hidden
                    $("#user-search-input").val("");
                    $("#user-search-output").empty().listview("refresh");
                });

            // Handle continuous lesson search
            $("#lesson-search").on("keyup", "#lesson-search-input", function () {
                var $this = $(this);
                if ($this.val() == "") {
                    delay(function () {
                        $("#lesson-search-output").empty().listview("refresh");
                    }, 300);
                } else {
                    delay(function () {
                        $.ajax({
                            url: server_url + 'j/lesson_search',
                            data: {phrase: $this.val()}
                        })
                            .done(function (data) {
                                var lessons = app.process_pulse(data);
                                var ul = $("#lesson-search-output");
                                ul.empty();
                                $.each(lessons, function (idx, lesson) {
                                    $("<li>").append(
                                        $('<a href="#lesson-details-page" data-transition="slide"></a>')
                                            .text(lesson.name)
                                            .data("lesson", lesson))
                                        .appendTo(ul);
                                });
                                ul.listview("refresh");
                            })
                            .fail(app.ajaxErrorHandler);
                    }, 300);
                }
            })
                .on("click", ".ui-input-clear", function () {
                    delay(function () {
                        $("#lesson-search-output").empty().listview("refresh");
                    }, 300);
                })
                .on("click", "#lesson-search-output a", function () {
                    currentLesson = $(this).data("lesson");
                })
                .on("pagehide", function () {
                    $("#lesson-search-input").val("");
                    $("#lesson-search-output").empty().listview("refresh");
                });


            // Save button on new teach page
            app.doms.pageNewTeach.find("footer a:eq(1)").on("click", function () {
                var form = $(this).closest("section").find("form"),
                    fields = {};
                $.each(form.serializeArray(), function (idx, field) {
                    fields[field.name] = $.trim(field.value);
                });
                fields.action = "create";
                // Must have name for the new teach class
                if (fields['name'] == '') {
                    app.alert('Class name is required.', undefined, 'Invalid Input');
                } else {
                    $.ajax({
                        type: 'POST',
                        url: server_url + 'j/process_lessons/',
                        data: JSON.stringify(fields)
                    })
                        .done(function (data) {
                            app.process_pulse(data);
                            form[0].reset();
                            app.showTeachLessons(me, app.doms.listTeaches);
                            history.back();
                        })
                        .fail(app.ajaxErrorHandler);
                }
            });

            // Handle click on teach list
            app.doms.listTeaches.on("click", "a", function () {
                currentTeach = $(this).data("lesson");
                app.doms.pageTeachRegs.find("header h1").text(currentTeach.name);
                app.showRegsForTeachLesson();
            });

            // Handle details button on teach regs page
            $("#teach-details-button").on("click", function () {
                var li0 = app.doms.pageTeachDetails.find(".ui-content li:eq(0)");
                li0.find("h2").text(currentTeach.name);
                li0.find("p:eq(0)").text(currentTeach.description);
                li0.find("p:eq(1)").text("Created: " + currentTeach.creation_time.split(" ")[0]);
                $.mobile.changePage(app.doms.pageTeachDetails, {
                    transition: "flip"
                });
                return false;
            });

            // fill the current teach details for popup
            app.doms.pageTeachDetails.on("pageshow", function () {
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
                        url: server_url + 'j/process_lessons/',
                        data: JSON.stringify({
                            action: "update",
                            name: currentTeach.name,
                            description: currentTeach.description,
                            lesson_id: currentTeach.lesson_id})
                    })
                        .done(function (data) {
                            app.process_pulse(data);
                            var li0 = app.doms.pageTeachDetails.find(".ui-content li:eq(0)");
                            li0.find("h2").text(currentTeach.name);
                            li0.find("p:eq(0)").text(currentTeach.description);
                            app.doms.pageTeachRegs.find("header h1").text(currentTeach.name);
                            var idxTeachList = teaches.indexOf(currentTeach);
                            app.doms.divsHomeContent.eq(homeNavIdx).find("ul a").eq(idxTeachList)
                                .get(0).firstChild.nodeValue = currentTeach.name;
                        })
                        .fail(app.ajaxErrorHandler);
                }
            });

            // Handle teach delete button
            $("#teach-delete-btn").on("click", function () {
                app.confirm('The operation is not reversible!',
                    function (btnIdx) {
                        if (btnIdx == 1) {
                            $.ajax({
                                type: 'POST',
                                url: server_url + 'j/process_lessons/',
                                data: JSON.stringify({
                                    action: "delete",
                                    lesson_id: currentTeach.lesson_id
                                })
                            })
                                .done(function (data) {
                                    app.process_pulse(data);
                                    homeNavIdx = -1; // force reload on teach list page
                                    $("#icon-teach").trigger("click");
                                    $.mobile.changePage(app.doms.pageHome, {
                                        transition: "pop",
                                        reverse: true
                                    });
                                })
                                .fail(app.ajaxErrorHandler);
                        }
                    }, 'Delete class?');
                return false;
            });

            // Modify the DOM accordingly based on which element invoke
            // the daytime dialog. Also sets the initial value of daytime
            // dialog accordingly as well.
            $("#daytime-dialog").on("click", "a", function () {
                var popup = $("#daytime-dialog"),
                    selecteds = popup.find("option[selected]");
                var daytime = selecteds.eq(0).text() + " "
                    + selecteds.eq(1).text() + ":"
                    + selecteds.eq(2).text() + " "
                    + selecteds.eq(3).text();
                if (popup.data("target").is("a")) {  // modify existing daytime
                    popup.data("target").find("span:eq(1)").text(daytime);
                } else {  // append nwe daytime entry
                    popup.data("target")
                        .append(app.createDaytimeLi(daytime))
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
                    var fields = app.parseClassDaytime($this.find("span:eq(1)").text());
                    var popup = $("#daytime-dialog"),
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

            // handle the click on the add class time button
            $(".daytime-list + a").on("click", function () {
                $("#daytime-dialog").data("target", $(this).prev("ul:eq(0)"));
            });

            // Handle the Done button on registration info page to save
            // the daytimes information.
            $("#registration-info-save-btn").on("click", function () {
                var daytimes = app.readDaytimeList($(this).closest("section").find(".daytime-list"));
                $.ajax({
                    type: "POST",
                    url: server_url + "j/process_lesson_regs/",
                    data: JSON.stringify({
                        reg_id: currentReg.reg_id,
                        daytimes: daytimes})
                })
                    .done(function (data) {
                        currentReg.daytimes = daytimes;
                        history.back();
                        app.process_pulse(data);
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Handle Save button for Offline new student page
            app.doms.pageNewStudentOffline.find("footer a:eq(1)").click(function () {
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
                    var $daytimeList = app.doms.pageNewStudentOffline.find(".daytime-list");
                    fields["daytimes"] = app.readDaytimeList($daytimeList);
                    fields.action = "enroll";
                    $.ajax({
                        type: 'POST',
                        url: server_url + 'j/process_lesson_requests/',
                        data: JSON.stringify(fields)
                    })
                        .done(function (data) {
                            app.process_pulse(data);
                            app.showRegsForTeachLesson(false);
                            history.back();
                            form[0].reset();
                            $daytimeList.empty();
                            currentTeach.nregs += 1;
                            var idxTeachList = teaches.indexOf(currentTeach);
                            app.doms.divsHomeContent.eq(homeNavIdx).
                                find("ul a span").
                                eq(idxTeachList).empty().text(currentTeach.nregs);
                        })
                        .fail(app.ajaxErrorHandler);
                }
            });

            // Handle Save button for Online new student page
            app.doms.pageNewStudentOnline.find("footer a:eq(1)").click(function () {
                var fields = {};
                fields['lesson_id'] = currentTeach.lesson_id;
                fields['student_id'] = currentUser.user_id;
                // add any class daytime entries
                var $daytimeList = app.doms.pageNewStudentOnline.find(".daytime-list");
                fields["daytimes"] = app.readDaytimeList($daytimeList);
                fields["message"] = $("#enroll-request-message").val();
                fields.action = "enroll";
                $.ajax({
                    type: "POST",
                    url: server_url + "j/process_lesson_requests/",
                    data: JSON.stringify(fields)
                })
                    .done(function (data) {
                        app.process_pulse(data);
                        history.back();
                        app.alert("Please wait for response from the student",
                            undefined,
                            "Request Sent");
                        $daytimeList.empty();
                        $("#enroll-request-message").val("");
                    })
                    .fail(app.ajaxErrorHandler);
            });


            // Handle the transition from teach regs page to stamps page
            app.doms.listStudents.on("click", "a", function () {
                currentReg = $(this).data("registration");
                // Save the start values in case the operations are cancelled
                currentReg.saved_total = currentReg.total;
                currentReg.saved_unused = currentReg.unused;
                currentReg.saved_data = currentReg.data;
                app.doms.pageStamps.find("header h1").text(app.getRegStudentDisplayName(currentReg));

                // No wobbly or delete badge when the stamps page is transitioned
                // from teach regs page
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");

                $.ajax({
                    url: server_url + "j/process_lesson_reg_logs/",
                    data: {reg_id: currentReg.reg_id}
                })
                    .done(function (data) {
                        stamps = app.process_pulse(data);
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
                    .fail(app.ajaxErrorHandler);
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

            // Handle stamps deletion and checkmark tick
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

            // Handle taphold to toggle stamps wobble
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
                var rlogs = [];
                $.each(stamps, function (idx, stamp) {
                    if (stamp.updated) {
                        var entry = {use_time: stamp.use_time, data: JSON.stringify(stamp.data)};
                        if (stamp.rlog_id == NEW_STAMP) {
                            rlogs.push($.extend(entry, {reg_id: currentReg.reg_id, action: "create"}));
                        } else {  // modified stamp
                            rlogs.push($.extend(entry, {rlog_id: stamp.rlog_id, action: "update"}));
                        }
                    }
                });
                $.each(stampsDeleted, function (idx, stamp) {
                    if (stamp.rlog_id != NEW_STAMP) {
                        rlogs.push({rlog_id: stamp.rlog_id, action: "delete"});
                    }
                });
                $.ajax({
                    type: 'POST',
                    url: server_url + 'j/process_lesson_reg_logs/',
                    data: JSON.stringify(rlogs)
                })
                    .done(function () {
                        var idxStudentList = registrations.indexOf(currentReg);
                        app.doms.pageTeachRegs.find("ul a span").
                            eq(idxStudentList).empty().text(currentReg.unused);
                        history.back();
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Cancel wobbly when top up is about to show
            app.doms.pageStamps.find("header a[href='#topup-dialog']").on("click", function () {
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");
            });

            // Handle transition to registration info page
            $("#registration-info-btn").on("click", function () {
                currentUser = currentReg.student;  // Note this could be null for non-member student
                app.doms.pageRegistrationInfo.find(".user-displayname")
                    .text(app.getRegStudentDisplayName(currentReg))
                    .end().find(".lesson-taken-count")
                    .text(currentReg.total - currentReg.unused)
                    .end().find(".lesson-unused-count")
                    .text(currentReg.unused);

                var $daytimeList = app.doms.pageRegistrationInfo.find(".daytime-list"),
                    daytimeList = currentReg.daytimes == "" ? [] : currentReg.daytimes.split(","),
                    a;
                $daytimeList.empty();
                $.each(daytimeList, function (idx, daytime) {
                    $daytimeList.append(app.createDaytimeLi(daytime));
                });
                app.refresh_listview($daytimeList);

                $.mobile.changePage(app.doms.pageRegistrationInfo, {
                    transition: "flip"
                });
                return false;
            });

            // handle student deletion
            $("#student-delete-btn").on("click", function () {
                app.confirm('The operation is not reversible!',
                    function (btnIdx) {
                        if (btnIdx == 1) {
                            $.ajax({
                                type: 'POST',
                                url: server_url + 'j/process_lesson_requests/',
                                data: JSON.stringify({action: "deroll", reg_id: currentReg.reg_id})
                            })
                                .done(function (data) {
                                    app.process_pulse(data);
                                    app.showRegsForTeachLesson();
                                    history.go(-2);  // go back to the teach regs page
                                    var idxTeachList = teaches.indexOf(currentTeach);
                                    currentTeach.nregs -= 1;
                                    app.doms.divsHomeContent.eq(homeNavIdx).find("ul a span").
                                        eq(idxTeachList).empty().text(currentTeach.nregs);
                                })
                                .fail(app.ajaxErrorHandler);
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

            // Handle click on study list to show study details
            app.doms.listStudies.on("click", "a", function () {
                var pageStudyDetails = $("#study-details-page");
                currentStudy = $(this).data("lesson");
                pageStudyDetails.find("header h1").text(currentStudy.name);
                $("#study-details-taken").text(
                        currentStudy.registration.total - currentStudy.registration.unused);
                $("#study-details-unused").text(currentStudy.registration.unused);
                $("#study-details-since").text(currentStudy.registration.creation_time.split(" ")[0]);

                pageStudyDetails.find(".study-details-daytime").remove();
                var daytimeList = currentStudy.registration.daytimes ? currentStudy.registration.daytimes.split(",") : [];
                $.each(daytimeList.reverse(), function (idx, daytime) {
                    $("#study-details-since").parent()
                        .after($('<li class="study-details-daytime"><span class="list-leading">Class time</span><span>'
                            + daytime + '</span></li>'));
                });

                $("#study-details-teacher").text(app.getUserDisplayName(currentStudy.teacher))
                    .closest("a").data("user", currentStudy.teacher);
                $("#study-details-name").text(currentStudy.name);
                $("#study-details-description").text(currentStudy.description);
                $("#study-details-lesson-since").text(currentStudy.creation_time.split(" ")[0]);
                $("#study-details-members").text(currentStudy.nregs);
                app.refresh_listview(pageStudyDetails.find("ul"));
                $.mobile.changePage(pageStudyDetails, {
                    transition: "slide"
                });
            });

            // handle lesson join button
            $("#lesson-join-btn").on("click", function () {
                $.ajax({
                    type: "POST",
                    url: server_url + "j/process_lesson_requests/",
                    data: JSON.stringify({
                        action: "join",
                        lesson_id: currentLesson.lesson_id,
                        message: $("#join-request-message").val()
                    })
                })
                    .done(function (data) {
                        app.process_pulse(data);
                        history.back();
                        app.alert("Please wait for response from the teacher",
                            undefined,
                            "Request Sent");
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Handle lesson quit button
            $("#lesson-quit-btn").on("click", function () {
                app.confirm('The operation is not reversible!',
                    function (btnIdx) {
                        if (btnIdx == 1) {
                            $.ajax({
                                type: 'POST',
                                url: server_url + 'j/process_lesson_requests/',
                                data: JSON.stringify({
                                    action: "quit",
                                    reg_id: currentStudy.registration.reg_id
                                })
                            })
                                .done(function (data) {
                                    app.process_pulse(data);
                                    $("#icon-study").trigger("click");
                                    history.back();
                                })
                                .fail(app.ajaxErrorHandler);
                        }
                    }, 'Delete class?');
                return false;
            });

            // Populate taken history page
            $("a[href='#taken-history-page']").on("click", function () {
                var reg_id;
                switch ($(this).closest("section").attr("id")) {
                    case "study-details-page":
                        reg_id = currentStudy.registration.reg_id;
                        break;
                    case "registration-info-page":
                        reg_id = currentReg.reg_id;
                        break;
                }
                var page = $("#taken-history-page"),
                    ul = page.find("ul");
                ul.empty();
                $.ajax({
                    url: server_url + "j/process_lesson_reg_logs/",
                    data: {reg_id: reg_id}
                })
                    .done(function (data) {
                        var logs = app.process_pulse(data);
                        var dateFields;
                        $.each(logs.reverse(), function (idx, log) {
                            if (log.use_time) {
                                dateFields = app.processTimestampString(log.use_time);
                                ul.append(
                                    $("<li></li>").text(
                                            dateFields.dateString + " " + dateFields.dayName + " " + dateFields.simpleTimeString));
                            }
                        });
                        app.refresh_listview(ul);
                    })
                    .fail(app.ajaxErrorHandler);
            });

            // Handle request accept, reject and dismiss
            $("#lesson-request-accept-btn, #lesson-request-decline-btn, #lesson-request-dismiss-btn")
                .on("click", function () {
                    var action;
                    switch ($(this).attr("id")) {
                        case "lesson-request-accept-btn":
                            action = "accept";
                            break;
                        case "lesson-request-decline-btn":
                            action = "reject";
                            break;
                        case "lesson-request-dismiss-btn":
                            action = "dismiss";
                            break;
                    }
                    console.log("action is ", action, $(this).attr("id"));
                    $.ajax({
                        type: "POST",
                        url: server_url + "j/process_lesson_requests/",
                        data: JSON.stringify({action: action, req_id: currentRequest.req_id})
                    })
                        .done(function (data) {
                            app.process_pulse(data);
                            var ul = $("#lesson-requests").find("ul");
                            ul.find("li").eq(currentRequest.listidx).remove();
                            app.refresh_listview(ul);
                            history.back();
                        })
                        .fail(app.ajaxErrorHandler);
                });

            // Populate user details page
            $(document).on("click", "a[href='#user-details-page']", function () {
                // The user can be associated to the element by either direct user object or
                // a registration object with user as its sub-element.
                // If none of them are available to the element, use existing currentUser
                currentUser = $(this).data("user") ||
                    ($(this).data("registration") ? $(this).data("registration").student : currentUser);

                console.log("currentUser is ", currentUser);

                if (!currentUser) {
                    app.alert("User profile is only available to LevelHub members.");
                    return false;
                }

                var pageUserDetails = $("#user-details-page");
                pageUserDetails.find("#user-details-header")
                    .find("h2").text(app.getUserDisplayName(currentUser))
                    .end().find("p").text("member since " + app.processTimestampString(currentUser.creation_time).dateString);
                pageUserDetails.find("#user-details-email").text(currentUser.email);
                pageUserDetails.find("#user-details-about").text(currentUser.about);
                var dateFields = app.processTimestampString(currentUser.last_login);
                pageUserDetails.find("#user-details-last-login").text(
                        dateFields.dateString + " " + dateFields.simpleTimeString);
            })
                // Populate the lesson details page
                .on("click", "a[href='#lesson-details-page']", function () {
                    currentLesson = $(this).data("lesson");
                    $("#lesson-details-name").text(currentLesson.name);
                    $("#lesson-details-teacher").text(app.getUserDisplayName(currentLesson.teacher))
                        .closest("a").data("user", currentLesson.teacher);
                    $("#lesson-details-description").text(currentLesson.description);
                    $("#lesson-details-creation_time").text(
                        app.processTimestampString(currentLesson.creation_time).dateString);
                    $("#lesson-details-nregs").text(currentLesson.nregs);
                })
                // Populate the lesson regs page
                .on("click", "a[href='#lesson-regs-page']", function () {
                    var targetPage = $("#lesson-regs-page"),
                        ul = targetPage.find("ul");
                    $.ajax({
                        url: server_url + "j/process_lesson_regs/",
                        data: {lesson_id: currentStudy.lesson_id}
                    })
                        .done(function (data) {
                            var registrations = app.process_pulse(data);
                            ul.empty();
                            $.each(registrations, function (idx, registration) {
                                $('<a href="#user-details-page" data-transition="slide"></a>')
                                    .text(app.getRegStudentDisplayName(registration))
                                    .data("registration", registration)
                                    .appendTo($("<li>")).parent().appendTo(ul);
                            });
                            app.refresh_listview(ul);
                        })
                        .fail(app.ajaxErrorHandler);
                })
                // Populate the new student online's student element
                .on("click", "a[href='#new-student-online']", function () {
                    currentUser = $(this).data("user");
                    app.doms.pageNewStudentOnline.find(".user-displayname")
                        .text(app.getUserDisplayName(currentUser));
                })
                // Populate the user teaches page
                .on("click", "a[href='#user-teaches-page']", function () {
                    currentUser = $(this).data("user") || currentUser;
                    app.showTeachLessons(currentUser, $("#user-teaches-page").find("ul"));
                })
                // Populate the lesson requests page
                .on("click", "a[href='#lesson-requests']", function () {
                    var ul = $("#lesson-requests").find("ul");
                    ul.empty();
                    $.ajax({
                        url: server_url + "j/process_lesson_requests/"
                    })
                        .done(function (data) {
                            $("#more-pulse").hide();
                            $("#new-requests-count").hide();
                            var lesson_requests = app.process_pulse(data),
                                texts;
                            $.each(lesson_requests, function (idx, request) {
                                switch (request.status) {
                                    case REQUEST_ENROLL:
                                        if (request.sender.username == me.username) {
                                            texts = "You requested to enroll " + app.getUserDisplayName(request.receiver) + " to " + request.lesson.name;
                                        } else {
                                            texts = app.getUserDisplayName(request.sender) + " requested to enroll you to " + request.lesson.name;
                                        }
                                        break;
                                    case REQUEST_JOIN:
                                        if (request.sender.username == me.username) {
                                            texts = "You asked to join " + request.lesson.name;
                                        } else {
                                            texts = app.getUserDisplayName(request.sender) + " wants to join " + request.lesson.name;
                                        }
                                        break;
                                    case REQUEST_ENROLL_ACCEPTED:
                                        texts = app.getUserDisplayName(request.receiver) + " accepted to be enrolled in " + request.lesson.name;
                                        break;
                                    case REQUEST_ENROLL_REJECTED:
                                        texts = app.getUserDisplayName(request.receiver) + "declined to enroll in " + request.lesson.name;
                                        break;
                                    case REQUEST_JOIN_ACCEPTED:
                                        texts = "You are accepted to join " + request.lesson.name;
                                        break;
                                    case REQUEST_JOIN_REJECTED:
                                        texts = "You are declined to join " + request.lesson.name;
                                        break;
                                    case REQUEST_DEROLL:
                                        texts = "You are disenrolled from " + request.lesson.name;
                                        break;
                                    case REQUEST_QUIT:
                                        texts = app.getUserDisplayName(request.sender) + " has quit from " + request.lesson.name;
                                }
                                $("<li>").append(
                                    $('<a href="#lesson-request-details" data-transition="slide"/>')
                                        .text(texts)
                                        .data("request", request))
                                    .appendTo(ul);
                            });
                            app.refresh_listview(ul);
                        })
                        .fail(app.ajaxErrorHandler);
                })
                .on("click", "a[href='#lesson-request-details']", function () {
                    var $this = $(this);
                    currentRequest = $this.data("request");
                    currentRequest.listidx = $this.parent().prevAll().length;
                    var page = $("#lesson-request-details");
                    page.find("#lesson-request-details-title").text($this.text());
                    if (currentRequest.sender.username == me.username) {
                        page.find("#lesson-request-details-user")
                            .text(app.getUserDisplayName(currentRequest.receiver))
                            .prev("span").text("To")
                            .parent().data("user", currentRequest.receiver);
                    } else {
                        page.find("#lesson-request-details-user")
                            .text(app.getUserDisplayName(currentRequest.sender))
                            .prev("span").text("From")
                            .parent().data("user", currentRequest.sender);
                    }
                    page.find("#lesson-request-details-lesson")
                        .text(currentRequest.lesson.name)
                        .parent().data("lesson", currentRequest.lesson);
                    page.find("#lesson-request-details-timestamp")
                        .text(app.processTimestampString(currentRequest.creation_time).dateString)
                    page.find("#lesson-request-details-message")
                        .text(currentRequest.message);

                    var btnYesNo = $("#lesson-request-details-yes-or-no"),
                        btnDismiss = $("#lesson-request-details-dismiss");
                    switch (currentRequest.status) {
                        case REQUEST_ENROLL:
                        case REQUEST_JOIN:
                            btnDismiss.hide();
                            if (currentRequest.receiver.username == me.username) {
                                btnYesNo.show();
                            } else {
                                btnYesNo.hide()
                            }
                            break;
                        case REQUEST_ENROLL_ACCEPTED:
                        case REQUEST_ENROLL_REJECTED:
                        case REQUEST_JOIN_ACCEPTED:
                        case REQUEST_JOIN_REJECTED:
                        case REQUEST_DEROLL:
                        case REQUEST_QUIT:
                            btnYesNo.hide();
                            btnDismiss.show();
                            break;
                        default:
                            btnYesNo.hide();
                            btnDismiss.hide();
                            break;
                    }
                });
        },

        // Process the pulse info and return the main payload
        process_pulse: function (data) {
            if (data.pulse) {
                if (data.pulse.n_new_requests) {
                    $("#more-pulse").show();
                    $("#new-requests-count").text(data.pulse.n_new_requests).show();
                }
                return data.main;
            } else {
                return data;
            }
        },

        getUserLessons: function (successHandler, category, user_id) {
            $.ajax({
                url: server_url + "j/process_lessons/",
                data: {category: category, user_id: user_id}
            })
                .done(successHandler)
                .fail(app.ajaxErrorHandler);
        },

        showMessages: function () {
            $.ajax({
                url: server_url + 'j/process_lesson_messages/'
            })
                .done(function (data) {
                    messages = app.process_pulse(data);
                    var messageList = $("#message-list");
                    messageList.empty();
                    var lastDateString = "",
                        today = app.getCurrentTimestamp(true);
                    $.each(messages, function (idx, entry) {
                        var message = entry.message,
                            lessons = entry.lessons;

                        var fields = message.creation_time.split(" "),
                            dateString = fields[0],
                            timeString = fields[1];

                        // list divider for showing the dates
                        if (dateString != lastDateString) {
                            lastDateString = dateString;
                            if (dateString == today) {
                                var headingValue = 'Today, ' + dateString;
                            } else {
                                var date = app.parseDate(dateString),
                                    headingValue = weekdays[date.getDay()] + ', ' + dateString;
                            }
                            messageList.append(
                                $('<li data-role="list-divider"></li>').text(headingValue));
                        }

                        var li = $('<li><h2></h2><div style="white-space: normal;"><p class="sender"></p><p>&nbsp;To&nbsp;</p><p class="lesson"></p><p class="time"></p></div></li>');
                        li.find("h2").text(message.body);
                        li.find(".sender").text(app.getUserDisplayName(message.sender));
                        var lesson_names = [];
                        $.each(lessons, function (idx, lesson) {
                            lesson_names.push(lesson.name);
                            if (lesson.teacher.user_id == message.sender.user_id) {
                                li.find("h2").css("font-weight", "bold");
                            }
                        });
                        li.find(".lesson").text(lesson_names.join(", "));
                        li.find(".time").text(app.formatTime(timeString));
                        messageList.append(li);
                    });
                    app.refresh_listview(messageList);
                })
                .fail(app.ajaxErrorHandler);
        },

        showTeachLessons: function (theUser, outputList) {
            $.ajax({
                url: server_url + 'j/process_lessons/',
                data: {category: "teach", user_id: theUser.user_id}
            })
                .done(function (data) {
                    data = app.process_pulse(data);
                    var href;
                    if (theUser === me) {
                        teaches = data;
                        href = "#";
                    } else {
                        href = "#lesson-details-page";
                    }
                    outputList.empty();
                    $.each(data, function (idx, teach) {
                        var a = $("<a>", {
                            href: href,
                            "data-transition": "slide",
                            text: teach.name
                        });
                        a.append($("<span>", {
                            class: "ui-li-count ui-btn-up-c ui-btn-corner-all",
                            text: teach.nregs
                        }))
                            .data("lesson", teach);
                        outputList.append($("<li>").append(a));
                    });
                    app.refresh_listview(outputList);
                })
                .fail(app.ajaxErrorHandler);
        },

        showRegsForTeachLesson: function (changePage) {
            changePage = changePage == undefined ? true : changePage;

            $.ajax({
                url: server_url + "j/process_lesson_regs/",
                data: {lesson_id: currentTeach.lesson_id}
            })
                .done(function (data) {
                    registrations = app.process_pulse(data);
                    app.doms.listStudents.empty();
                    $.each(registrations, function (idx, registration) {
                        var a = $("<a>", {
                            href: "#",
                            text: app.getRegStudentDisplayName(registration)
                        })
                            .data("registration", registration);
                        a.append($("<span>", {
                            "class": "ui-li-count ui-btn-up-c ui-btn-corner-all",
                            text: registration.unused
                        }));
                        app.doms.listStudents.append($("<li>").append(a));
                    });
                    app.refresh_listview(app.doms.listStudents);

                    if (changePage) {
                        $.mobile.changePage(app.doms.pageTeachRegs, {
                            transition: "slide"
                        });
                    }
                })
                .fail(app.ajaxErrorHandler);
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

        showStudyLessons: function () {
            $.ajax({
                url: server_url + 'j/process_lessons/',
                data: {category: "study"}
            })
                .done(function (data) {
                    studies = app.process_pulse(data);
                    app.doms.listStudies.empty();
                    $.each(studies, function (idx, study) {
                        var a = $('<a href="#"/>')
                            .append($("<h2></h2><p><strong></strong></p><p></p>"))
                            .data("lesson", study);
                        a.find("h2").text(study.name);
                        a.find("strong").text(app.getUserDisplayName(study.teacher));
                        a.find("p:last-child").text(study.description);
                        app.doms.listStudies.append($("<li>").append(a));
                    });
                    app.refresh_listview(app.doms.listStudies);
                })
                .fail(app.ajaxErrorHandler);
        },

        showSetup: function () {
            var btn = $("#my-details-btn"),
                name, headingText;
            if (me.reg_id != undefined) {
                name = app.getRegStudentDisplayName(me);
                headingText = "Enrolled ";
            } else {
                name = app.getUserDisplayName(me);
                headingText = "Member since ";
            }
            btn.find("h2").text(name);
            btn.find("p").text(
                    headingText + app.processTimestampString(me.creation_time).dateString);
        },

        createDaytimeLi: function (daytime) {
            var a = $('<a href="#"><span class="list-leading">Class time</span><span></span></a>');
            a.find("span:eq(1)").text(daytime);
            return $("<li>").append(a).append($('<a href="#">delete</a>'));
        },

        readDaytimeList: function ($daytimeList) {
            var theList = [];
            $.each($daytimeList.find("li a:not([title='delete']) span:not(.list-leading)"),
                function (idx, dom) {
                    theList.push(dom.innerHTML);
                });
            return theList.join(",");
        },

        getCurrentTimestamp: function (dateOnly) {
            dateOnly = typeof dateOnly == 'undefined' ? false : dateOnly;

            var now = new Date();
            var mon = now.getMonth() + 1;
            var date = now.getDate();

            if (mon < 10) mon = '0' + mon;
            if (date < 10) date = '0' + date;

            var dateString = now.getFullYear() + '-' + mon + '-' + date;
            if (dateOnly) {
                return dateString;
            } else {
                var hour = now.getHours();
                var min = now.getMinutes();
                var sec = now.getSeconds();
                if (hour < 10) hour = '0' + hour;
                if (min < 10) min = '0' + min;
                if (sec < 10) sec = '0' + sec;
                return dateString + ' ' + hour + ':' + min + ':' + sec;
            }
        },

        processTimestampString: function (tsString) {
            // timestamp string is of format YYYY-MM-DD HH:MM:SSZ
            var fields = tsString.split(" "),
                dateString = fields[0],
                timeString = fields[1].slice(0, 8),
                tzString = fields[1].slice(8);

            if (tzString != "Z") {
                console.log("Time Zone is not UTC [" + tzString + "]", tsString);
            }

            var date = app.parseDate(dateString),
                dayName = weekdays[date.getDay()],
                simpleTimeString = app.formatTime(timeString);

            return {
                dateString: dateString,
                timeString: timeString,
                dayName: dayName,
                simpleTimeString: simpleTimeString
            };
        },

        parseDate: function (dateString) {
            // dateString is of format YYYY-MM-DD
            var fields = dateString.split("-"),
                date = new Date(parseInt(fields[0]), parseInt(fields[1]) - 1, parseInt(fields[2]));
            return date;
        },

        formatTime: function (timeString) {
            // timeString is of format HH:MM:SS
            var fields = timeString.split(":"),
                hour = parseInt(fields[0]),
                min = fields[1];

            if (hour == 12) {
                return hour + ':' + min + ' PM';
            } else if (hour == 0) {
                return '12:' + min + ' AM';
            } else if (hour < 12) {
                return (hour < 10 ? '0' + hour : hour) + ":" + min + " AM";
            } else {
                hour -= 12;
                return (hour < 10 ? '0' + hour : hour) + ":" + min + " PM";
            }
        },

        parseClassDaytime: function (daytime) {
            var fields = daytime.split(" ");
            var day = fields[0],
                hourmin = fields[1].split(":"),
                hour = hourmin[0],
                min = hourmin[1],
                ampm = fields[2];
            return [weekdays.indexOf(day), parseInt(hour) - 1, parseInt(min), periods.indexOf(ampm)];
        },

        getUserDisplayName: function (student) {
            var name = [student.first_name, student.last_name].join(" ");
            return name != " " ? name : student.username;
        },

        getRegStudentDisplayName: function (registration) {
            if (registration.student) {
                return app.getUserDisplayName(registration.student);
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
            console.log(message);
            navigator.notification.alert(message, callback, title);
        },

        confirm: function (message, callback, title) {
            console.log(message);
            navigator.notification.confirm(message, callback, title);
        },

        ajaxErrorHandler: function (jqXHR, textStatus, errorThrown) {
            // hide any possible still showing ajax loader
            $.mobile.loading("hide");
            if (textStatus != "canceled") {
                console.log('AJAX call failed: ' + textStatus);
                console.log(jqXHR);
                if (textStatus == "timeout") {
                    app.ajaxErrorAlert("Connection timeout. Please try again.");
                } else if (jqXHR.status == 500) {
                    app.ajaxErrorAlert("Server error. Please try again.");
                } else if (jqXHR.status == 404) {
                    app.ajaxErrorAlert("Page not found.")
                } else if (jqXHR.status == 0) {
                    app.ajaxErrorAlert("Connection error. Please try again.");
                }
                else {
                    app.ajaxErrorAlert(jqXHR.responseText);
                }
            }
        },

        ajaxErrorAlert: function (message) {
            var page = $.mobile.activePage,
                pageWidth = page.outerWidth(),
                pageHeight = page.outerHeight(),
                alertDom = $("#ajax-error-alert");

            alertDom.text(message);
            alertDom.css({
                'margin-left': -0.5 * alertDom.outerWidth() + 'px',
                'left': 0.5 * pageWidth + 'px',
                'top': 0.125 * pageHeight + 'px',
                'display': 'block',
                'opacity': 1
            })
                .stop().fadeOut(6000);
        }
    };

    app.initialize();

    $("#reset-db").click(function () {
        console.log("Reset DB");
        $.ajax({
            type: 'POST',
            url: server_url + 'debug_reset_db/',
            dataType: "text"
        })
            .done(function () {
                homeNavIdx = -1;  // force reload on teach list page
                $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
            })
            .fail(app.ajaxErrorHandler);
    });

})(jQuery);

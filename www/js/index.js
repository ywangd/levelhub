(function ($) {
    // Tell jquery to not fire tap event when taphold is fired
    $.event.special.tap.emitTapOnTaphold = false;

    var user = {};
    var messages;
    var teaches, currentTeach;
    var studies, currentStudy;
    var registrations, currentReg;
    var stamps, stampsDeleted;
    var stampFirstIdx, stampLastIdx;

    var matchedUsers;

    var NEW_STAMP = -1;

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

    var server_url = "http://levelhub-ywangd.rhcloud.com/";
    server_url = "http://localhost:8000/";
    //server_url = "http://10.0.2.2:8000/";

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

            // Always attach json as a parameter to request for json data
            $.ajaxPrefilter(function (options, originalOptions, jqXhr) {
                // Ensure the same ajax call does not fire twice in a row
                if (ajaxThrottle[options.url] && (Date.now() - ajaxThrottle[options.url]) < throttleInterval) {
                    console.log('Aborting duplicate ajax call ...');
                    jqXhr.abort();
                } else {
                    ajaxThrottle[options.url] = Date.now();
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
                pageNewStudent: $("#new-student"),
                pageStamps: $("#stamps-page"),
                pageTeachRegsDetails: $("#teach-regs-details-page"),
                pageStudentInfo: $("#student-info-page"),
                headerHome: $("#home-header"),
                btnHomeUR: $("#home-btn-right"),
                listStudents: $("#student-list"),
                listTeaches: $("#teach-list"),
                listStudies: $("#study-list"),
                popNewStudentDaytime: $("#new-student-daytime-dialog"),
                listNewStudentDaytime: $("#new-student-daytime-list"),
                listStudentHistory: $("#student-history"),
                listStudentDaytime: $("#student-daytime-list")
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
                    totalWidth = app.doms.pageLogin.css("width"), // window.innerWidth,
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
                            app.doms.btnHomeUR.removeClass("ui-icon-refresh")
                                .addClass("ui-icon-plus").attr({
                                    "href": "#new-message",
                                    "data-transition": "slidedown"
                                }).show();
                            app.showMessages();
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
                            app.showStudyLessons();
                            break;
                        case "setup":
                            app.doms.headerHome.find("h1").text("Settings");
                            app.doms.btnHomeUR.hide();
                            app.showSetup();
                            app.finishHomeNav();
                            break;
                    }
                }
                return false;
            });

            // make sure the settings are displayed correctly based on their values
            if (localStorage.getItem("homeContent")) {
                var radios = $("#setup-first-page input:radio");
                radios.checkboxradio();
                radios.filter("[value=" + localStorage.getItem("homeContent") + "]").attr("checked", true);
                radios.checkboxradio("refresh");
            } else {
                localStorage.setItem("homeContent", $("#setup-first-page input:radio:checked").val());
            }

            // The first page to show
            var savedUser = localStorage.getItem('user');
            if (savedUser) {
                user = JSON.parse(savedUser);
                app.get_user_lesssons(function () {
                    $.mobile.changePage(app.doms.pageHome);
                    $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
                });
            }

            $("#setup-first-page").on("click", "label", function () {
                localStorage.setItem("homeContent", $(this).next("input").val());
            });

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
                        user = data;
                        localStorage.setItem('user', JSON.stringify(user));
                        app.get_user_lesssons(function () {
                            $.mobile.changePage(app.doms.pageHome, {
                                transition: "slideup"
                            });
                            $("#icon-" + localStorage.getItem("homeContent")).trigger("click");
                            form[0].reset();
                        });
                    })
                    .fail(app.ajaxErrorHandler);
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
                    .fail(app.ajaxErrorHandler);
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
                            user = data;
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


            var recipientSelection = $("#recipient-selection"),
                lessonGroups = $("#lesson-groups"),
                individualLesson = $("#individual-lesson"),
                recipientButton = $("#choose-recipients");

            // populate recipient list based on user lessons
            app.doms.pageNewMessage.on("pagebeforeshow", function () {
                recipientSelection.hide();
                lessonGroups.empty();
                individualLesson.hide().empty();
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
            });

            // When recipient button is clicked, toggle the recipient selection box
            // Also change the direction of carat to indicate expand or collapse
            recipientButton.on("click", function () {
                var $this = $(this);
                recipientSelection.toggle();
                $this.toggleClass("ui-icon-carat-d ui-icon-carat-u");
            });

            // Change text on the recipient button accordingly based on the selection
            // of recipients. The selection can be a radio or checkbox input.
            // The first three radio inputs are simple (just display their values).
            // The last radio input is for opening the individual lesson selection.
            // The checkbox can not be processed using the click event, because their
            // values are changed after the click event. Thus the value is incorrect
            // when inside the click handler. The following "change" handler is used
            // to handle the checkbox changes.
            lessonGroups.on("click", "label", function () {
                var $this = $(this);
                if ($this.attr("for") != "recipient-radio-3") {
                    individualLesson.hide();
                    recipientButton.text($this.text());
                } else {
                    individualLesson.show().find("input:eq(0)").trigger("change");
                }
            });

            individualLesson.on("change", "input", function () {
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
                    url: server_url + "j/lesson_messages/",
                    data: JSON.stringify({create: {body: body, lesson_ids: lesson_ids}})
                })
                    .done(function (data) {
                        app.showMessages();
                        history.back();
                        $("#lesson-message-body").closest("form")[0].reset();
                    })
                    .fail(app.ajaxErrorHandler);

                return false;
            });


            $("#user-search-input").keyup(function () {
                console.log("keyup");
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
                                matchedUsers = data;
                                var ul = $("#user-search-output");
                                ul.empty();
                                $.each(matchedUsers, function (idx, u) {
                                    $("<li>").append(
                                        $('<a href="#"></a>')
                                            .text(app.getUserDisplayName(u)))
                                        .appendTo(ul);
                                });
                                ul.listview("refresh");
                            })
                            .fail(app.ajaxErrorHandler);
                    }, 300);
                }
            });

            $("#user-search").on("click", ".ui-input-clear", function () {
                delay(function () {
                    $("#user-search-output").empty().listview("refresh");
                }, 300);
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
                        .fail(app.ajaxErrorHandler);
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
                            var li0 = app.doms.pageTeachRegsDetails.find(".ui-content li:eq(0)");
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
                    popup.data("target").text(daytime);
                } else {  // append nwe daytime entry
                    popup.data("target")
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

            $(".daytime-list + a").on("click", function () {
                $("#daytime-dialog").data("target", $(this).prev("ul:eq(0)"));
            });

            // Handle done button on student details page
            // It modifies the currentReg object if data is changed
            // the object is later persistent into the database if save button
            // is clicked on the stamps page.
            app.doms.pageStudentInfo.find("header a").on("click", function () {
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
                        })
                        .fail(app.ajaxErrorHandler);
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
                app.doms.pageStamps.find("header h1").text(app.getRegStudentDisplayName(currentReg));

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
                    .fail(app.ajaxErrorHandler);
            });

            // Cancel wobbly when top up is about to show
            app.doms.pageStamps.find("header a[href='#topup-dialog']").on("click", function () {
                var stampDoms = app.doms.containersStamps.find(".stamp");
                stampDoms.removeClass("wobbly");
                stampDoms.find("img.x-delete").addClass("hidden");
            });

            // Handle transition to student details page
            $("#student-details-button").on("click", function () {
                var li0 = app.doms.pageStudentInfo.find(".ui-content li:eq(0)");
                li0.find("h2").text(app.getRegStudentDisplayName(currentReg));
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

                $.mobile.changePage(app.doms.pageStudentInfo, {
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
                                    app.showRegsForTeachLesson();
                                    $.mobile.changePage(app.doms.pageTeachRegs, {
                                        transition: "pop",
                                        reverse: true
                                    });
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

        get_user_lesssons: function (sucessHandler) {
            $.ajax({
                url: server_url + "j/get_user_lessons/"
            })
                .done(function (data) {
                    teaches = data.teach;
                    studies = data.study;
                })
                .done(sucessHandler)
                .fail(app.ajaxErrorHandler);
        },

        finishHomeNav: function () {
            var activeContentDiv = app.doms.divsHomeContent.eq(homeNavIdx);
            app.doms.divsHomeContent.hide();
            activeContentDiv.show();
            $.mobile.loading("hide");
        },

        showMessages: function () {
            $.ajax({
                url: server_url + 'j/lesson_messages/'
            })
                .done(function (data) {
                    messages = data;
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
                                    headingValue = days[date.getDay()] + ', ' + dateString;
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
                    app.finishHomeNav();
                })
                .fail(app.ajaxErrorHandler);
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
                    app.refresh_listview(app.doms.listTeaches);
                    app.finishHomeNav();
                })
                .fail(app.ajaxErrorHandler);
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
                            text: app.getRegStudentDisplayName(registration)
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
                url: server_url + 'j/get_study_lessons/'

            })
                .done(function (data) {
                    studies = data;
                    app.doms.listStudies.empty();
                    $.each(studies, function (idx, study) {
                        var a = $('<a href="#study-details-page" data-transition="slide"/>')
                            .append($("<h2></h2><p><strong></strong></p><p></p>"));
                        a.find("h2").text(study.name);
                        a.find("strong").text(app.getUserDisplayName(study.teacher));
                        a.find("p:last-child").text(study.description);
                        app.doms.listStudies.append($("<li>").append(a));
                    });
                    app.refresh_listview(app.doms.listStudies);
                    app.finishHomeNav();
                })
                .fail(app.ajaxErrorHandler);
        },

        showSetup: function () {
            var btn = $("#user-details-btn");
            btn.find("h2").text(app.getUserDisplayName(user));
            btn.find("p").text("since " + user.creation_time.split(" ")[0])
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
            return [days.indexOf(day), parseInt(hour) - 1, parseInt(min), periods.indexOf(ampm)];
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
            navigator.notification.alert(message, callback, title);
            console.log(message);
        },

        confirm: function (message, callback, title) {
            console.log(navigator.notification);
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
                .stop().fadeOut(4000);
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
            .fail(app.ajaxErrorHandler);
    });

})(jQuery);

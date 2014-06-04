(function ($) {
    var db;

    var app = {
        initialize: function () {
            $(document).ready(function () {
                $(document).bind("deviceready", app.onDeviceReady)
            });
        },

        onDeviceReady: function () {
            db = window.openDatabase("levelhub.sqlite", "1.0", "LevelHub", 5 * 1024 * 1024);
            var ul = $("ul[data-id='studentList']");
            $.each(app.queryStudentForTeach(1), function (idx, val) {
                ul.append(val);
            })

        },

        queryStudentForTeach: function (teach_id) {
            alert("queryStudentForTeach");
            db.transaction(function (tx) {
                tx.executeSql(
                    "SELECT * FROM TeachRegs WHERE teach = ?;",
                    [teach_id],
                    function (tx, result) {
                        app.buildStudentsForTeach(result);
                    },
                    app.dbError
                );
            });
        },

        buildStudentsForTeach: function (result) {
            alert("buildStudentsForTeach");
            var ret = []
            for (var i = 0; i < result.rows.length; i++) {
                var row = result.rows.item(i);
                ret.push($("<li>").append($("<a>", {
                    "href": "#studentStamp",
                    "data-transition": "slide",
                    text: row.fname + " " + row.lname
                })));
            }
            return $(ret);
        },

        dbError: function (tx, err) {
            alert("DB Error " + err.message);
            console.log("DB error: " + err.message);
            return false;
        }
    };


    $("#testClick").click(function (e) {
        alert("Clicked");
    });

    app.initialize();

})(jQuery);

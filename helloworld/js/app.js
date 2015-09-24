app = function () {

    var userId = 'myUserID';

    var sharedStates = {};
    map = mediascape.mappingService("", {
        userId: userId
    });

    $('#getMapping').click(function () {
        map.getUserMapping(APP_ID, ['user', 'app', 'userApp']).then(function (data) {
            gotMapping(data);
        }).catch(function (erorr) {
            console.log(erorr)
        });
    });

    function gotMapping(data) {
        $('#field-mapping-user').html(data.user);
        $('#field-mapping-app').html(data.app);
        $('#field-mapping-userApp').html(data.userApp);


        $(".connect[sstype='user']").attr('url', data.user);
        $(".connect[sstype='app']").attr('url', data.app);
        $(".connect[sstype='userApp']").attr('url', data.userApp);

        $('.connect').click(function () {
            connectSharedState($(this).attr('sstype'), $(this).attr('url'));
        });

        $('.setItem').click(function () {
            onSetItem($(this).attr('sstype'));
        });
    }

    function onSetItem(type) {
        if (sharedStates[type]) {
            var value = $('.form-' + type + ' input[id=value]').val();
            var key = $('.form-' + type + ' input[id=key]').val();
            if (value && key) {
                $('.form-' + type + ' input[id=key]').val('');
                $('.form-' + type + ' input[id=value]').val('');
                sharedStates[type].setItem(key, value);
            }
        }

    }

    function connectSharedState(type, url) {
        if (type && url) {
            if (!sharedStates[type]) {
                sharedStates[type] = mediascape.sharedState(url, {
                    userId: userId
                });
                sharedStates[type].on('readystatechange', function (data) {});

                sharedStates[type].on('change', function (data) {
                    onChange(data, type);
                });
                sharedStates[type].on('remove', function (data) {
                    onRemove(data, type);
                })
            }
        }
        $('.connect[sstype=' + type + ']').prop('disabled', true);
    }



    function removeKey(type, key) {
        sharedStates[type].removeItem(key);
    }

    function onChange(data, type) {
        var old_tr = $("tr[sstype='" + type + "'][key='" + data.key + "']");
        if (old_tr.length > 0) {
            htmlString = '<td>';
            htmlString += JSON.stringify(data.key);
            htmlString += '</td>';
            htmlString += '<td>';
            htmlString += JSON.stringify(data.value);
            htmlString += '</td>';
            htmlString += '<td>';
            htmlString += '<button type="button" sstype="' + type + '" class="btn btn-default btn-xs ss-remove" key="' + data.key + '" ><span class="glyphicon glyphicon-remove"></span></button>';
            htmlString += '</td>';
            $("tr[sstype='" + type + "'][key='" + data.key + "']").html(htmlString);
            $(".ss-remove[sstype='" + type + "']").click(function () {
                removeKey($(this).attr('sstype'), $(this).attr('key'))
            });
        } else {
            htmlString = '<tr sstype="' + type + '"  key="' + data.key + '">';
            htmlString += '<td>';
            htmlString += JSON.stringify(data.key);
            htmlString += '</td>';
            htmlString += '<td>';
            htmlString += JSON.stringify(data.value);
            htmlString += '</td>';
            htmlString += '<td>';
            htmlString += '<button type="button" sstype="' + type + '" class="btn btn-default btn-xs ss-remove" key="' + data.key + '" ><span class="glyphicon glyphicon-remove"></span></button>';
            htmlString += '</td>';
            $('#table-' + type + ' > tbody:last').append(htmlString);
            $(".ss-remove[sstype='" + type + "']").click(function () {
                removeKey($(this).attr('sstype'), $(this).attr('key'))
            });

        }
        console.log('onChange', data, type);
    }

    function onRemove(data, type) {
        console.log('onRemove', data, type);
        $("tr[sstype='" + type + "'][key='" + data.key + "']").remove();
    }
}
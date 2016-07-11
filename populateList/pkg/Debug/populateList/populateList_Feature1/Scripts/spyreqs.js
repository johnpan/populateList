(function (window) {
    "use strict";
    var appUrl, hostUrl, queryParams,
        executor, baseUrl, targetStr,
		notAnApp_FlagSum = 0,
        webPropertiesStorage = {
            "appWebProperties": { isUnloaded: true },
            "hostWebProperties": { isUnloaded: true },
        },
		say, rest, jsom, inAppMode = true,
        spyreqs, spyreqs_version = "0.0.27";

    initSay();
    initSpyreqs();
    //#region ----------------------------------------------------------- init  
    function initSay() {
        // init 'say' fn
        if (typeof window.console !== 'undefined') {
            say = function (what) { window.console.log(what); };
        } else if ((typeof window.top !== 'undefined') && (typeof window.top.console !== 'undefined')) {
            say = function (what) { window.top.console.log(what); };
        } else if ((typeof window.opener !== 'undefined') && (typeof window.opener.console !== 'undefined')) {
            say = function (what) { window.opener.console.log(what); };
        } else { say = function () { }; }
    }

    function initSpyreqs() {
        // init spyreqs, check if it runs for a Sharepoint App or a solution
        var initTimer, isReady = false, initModeMsg = "",
            windowDefaultRepo = window.localStorage;
        queryParams = urlParamsObj();

        if (typeof queryParams.SPAppWebUrl !== 'undefined') {
            appUrl = decodeURIComponent(queryParams.SPAppWebUrl);
            if (appUrl.indexOf('#') !== -1) {
                appUrl = appUrl.split('#')[0];
            }
        } else if (windowDefaultRepo.spyreqsAppUrl) {
            // spyreqs has discover the param before in this session
            appUrl = windowDefaultRepo.spyreqsAppUrl;
            initModeMsg = "storage";
        } else { notAnApp_FlagSum++; }

        if (typeof queryParams.SPHostUrl !== 'undefined') {
            hostUrl = decodeURIComponent(queryParams.SPHostUrl);
            // for rest use
            prepRest();
        } else if (windowDefaultRepo.spyreqsHostUrl) {
            // spyreqs has discover the param before in this session
            hostUrl = windowDefaultRepo.spyreqsHostUrl;
            initModeMsg = "storage";
            // for rest use
            prepRest();
        } else { notAnApp_FlagSum++; }

        if (notAnApp_FlagSum != 0) {
            // spyreqs did not find SPHostUrl or SPAppWebUrl or neither in url query params or in windowDefaultRepo
            // will try to discover on its own in case we are still running in an app
            if (discoverIfApp(window.location.host)) {
                // spyreqs assumes it runs in an app without the proper params, now tries to build app&host Url                
                appUrl = decodeURIComponent(tryBuildAppUrl());
                hostUrl = decodeURIComponent(tryBuildHostUrlFromAppUrl(appUrl));
                prepRest();
                initModeMsg = "app - auto discover";
                say("spyreqs assumed: appUrl: " + appUrl + " - hostUrl:" + hostUrl);
            } else { iAmNotInApp(); }
        } else { if (initModeMsg == "") initModeMsg = "app"; }

        say("spyreqs init mode: " + initModeMsg);
        // appUrl && hostUrl are found, keep them in the windowDefaultRepo in case some page does not have them in its urlQuery params
        windowDefaultRepo.spyreqsAppUrl = appUrl;
        windowDefaultRepo.spyreqsHostUrl = hostUrl;
        // windowDefaultRepo is very usefull if a custom action on some item opens the app with no SPHostUrl & SPAppWebUrl params

        function prepRest() {
            targetStr = "&@target='" + hostUrl + "'";
            baseUrl = appUrl + "/_api/SP.AppContextSite(@target)/";
            executor = new SP.RequestExecutor(appUrl);
        }

        function tryBuildHostUrlFromAppUrl(appUrl) {
            // remove app website
            var temphostUrl = removeLastSlash(appUrl);
            // remove the hash
            var domain = window.location.host.split('.')[0],
                parts = domain.split('-'),
                hash = parts[parts.length - 1];
            return temphostUrl.replace("-" + hash, "");
        }

        function tryBuildAppUrl() {
            // remove file name (usually default.aspx)
            if (!window.location.origin) {
                // fix IE bug of not define origin
                window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
            }
            appUrl = window.location.origin + removeLastSlash(window.location.pathname);
            if (appUrl.toLowerCase().substring(appUrl.length - "/Pages".length) == "/pages") {
                // remove that too
                appUrl = appUrl.slice(0, appUrl.lastIndexOf("/"));
            }
            return appUrl;
        }

        function removeLastSlash(url) {
            return url.slice(0, url.lastIndexOf("/"));
        }

        function iAmNotInApp() {
            // this is not an app, so assing the proper web url to both vars
            // to do... spyreqs is not ready yet since it has to load some js, but may be called and cause exception
            // spyreqs thinks this is not a sharepoint app, since url params 'SPHostUrl' or 'SPAppWebUrl' 
            // or both are missing, AND there is no hash code in the domain
            initModeMsg = "no app";
            inAppMode = false;
            var url = window.location.href;
            appUrl = hostUrl = url.substring(0, url.indexOf('/Pages'));
            if (appUrl.length < 1) {
                appUrl = hostUrl = url.substring(0, url.indexOf("?"));
            }
            // load SP.RequestExecutor to let REST work on host site api
            $.getScript(hostUrl + "/_layouts/15/SP.RequestExecutor.js")
            .done(function (script, textStatus) {
                say('loaded: RequestExecutor.js');
                executor = new SP.RequestExecutor(hostUrl);
                targetStr = "&@target='" + hostUrl + "'";
                baseUrl = appUrl + "/_api/SP.AppContextSite(@target)/";
            })
            .fail(function (script, textStatus) {
                say('could not load: RequestExecutor.js');
            });
            // load sp.js for jsom use if not already loadad            
            if (!SP.ClientContext) {
                say("spyreqs is waiting for sp.js");
                initTimer = setInterval(testReady, 500);
            } else {
                say('sp.js is already loaded')
                if (typeof window.onSpyreqsReady == 'function') window.onSpyreqsReady();
            }
        }

        function discoverIfApp(theurl) {
            // check length of the hash... and pray!
            var domain = theurl.split('.')[0],
                parts = domain.split('-'),
                hash = parts[parts.length - 1];
            return (hash.length == 14);
        }

        function testReady() {
            if (!isReady) {
                SP.SOD.executeFunc('sp.js', 'SP.ClientContext.get_current',
					function () {
					    say('loaded: sp.js');
					    if (!isReady) {
					        if (typeof window.onSpyreqsReady == 'function') window.onSpyreqsReady();
					        isReady = true;
					    }
					    clearInterval(initTimer);
					}
				);
            } else {
                clearInterval(initTimer);
            }
        }
    }
    //#endregion ----------------------------------------------------------- init  

    //#region ----------------------------------------------------------- async
    function postAsync(url) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: 'POST',
            headers: {
                Accept: "application/json;odata=verbose"
            },
            success: defer.resolve,
            error: defer.reject
        });

        return defer.promise();
    }

    function getAsync(url) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "GET",
            dataType: "json",
            headers: {
                Accept: "application/json;odata=verbose"
            },
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                defer.reject(error);
            }
        });

        return defer.promise();
    }

    function getFile(url) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url, method: "GET",
            success: function (data) {
                defer.resolve(data.body);
            },
            fail: function (error) { defer.reject(error); },
            error: function (error) { defer.reject(error); }
        });
        return defer.promise();
    }

    function addFile(url, file) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "Accept": "application/json;odata=verbose"
            },
            contentType: "application/json;odata=verbose",
            body: file,
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function addFolder(url, data) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "ACCEPT": "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose"
            },
            contentType: "application/json;odata=verbose",
            body: JSON.stringify(data),
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function deleteAsync(url, etag) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            headers: {
                "Accept": "application/json;odata=verbose",
                "X-HTTP-Method": "DELETE",
                "If-Match": etag ? etag : "*"
            },
            success: function (data) {
                //data.body is an empty string
                defer.resolve(data);
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function updateAsync(url, data) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Accept": "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose",
                "X-HTTP-Method": "MERGE",
                "If-Match": (data.__metadata && data.__metadata.etag) ? data.__metadata.etag : "*"
            },
            success: function (data) {
                //data.body is an empty string
                defer.resolve(data);
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                defer.reject(error);
            }
        });
        return defer.promise();
    }

    function createAsync(url, data) {
        var defer = new $.Deferred();

        executor.executeAsync({
            url: url,
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                Accept: "application/json;odata=verbose",
                "Content-Type": "application/json;odata=verbose"
            },
            success: function (data) {
                defer.resolve(JSON.parse(data.body));
            },
            fail: function (error) {
                defer.reject(error);
            },
            error: function (error) {
                say("ajax error:" + error.statusText);
                defer.reject(error);
            }
        });
        return defer.promise();
    }
    //#endregion ----------------------------------------------------------- async

    function checkQuery(query) {
        /**
    * checks if the query argument is a string and if it is not returns an empty string
    * @param  {string} query [the query to execute]
    * @return {string}       [the input query or an empty string]
    */
        if (typeof query === 'undefined' || (typeof query !== 'string' && !(query instanceof String))) {
            return '';
        }
        return query;
    }

    function newRemoteContextInstance() {
        // for jsom use. Return an object with new instances for clear async requests
        var returnObj = {}, context, factory, appContextSite;
        if (!SP.ClientContext) {
            say("SP.ClientContext not loaded"); return null;
        }
        context = new SP.ClientContext(appUrl);
        factory = new SP.ProxyWebRequestExecutorFactory(appUrl);
        context.set_webRequestExecutorFactory(factory);
        appContextSite = new SP.AppContextSite(context, hostUrl);

        returnObj.context = context;
        returnObj.factory = factory;
        returnObj.appContextSite = appContextSite;
        return returnObj;
    }

    function newLocalContextInstance() {
        // for jsom use. Return an object with new instances for clear async requests        
        var returnObj = {}, context, appContextSite;
        if (!SP.ClientContext) {
            say("SP.ClientContext was not loaded, loading now. Please try again");
            SP.SOD.executeFunc('sp.js', 'SP.ClientContext.get_current',
                function () { say('loaded: sp.js, spyreqs ready'); }
            );
            return null;
        }
        if (!inAppMode) {
            //say("not-in-app-mode. current web used");
            context = new SP.ClientContext.get_current();
        } else {
            context = new SP.ClientContext(appUrl);
        }
        returnObj.context = context;
        // nasty hack safelly find the obj
        returnObj.appContextSite = context;
        return returnObj;
    }

    function urlParamsObj() {
        // function returns an object with url parameters
        if (window.location.search) { // if there are params in URL
            var param_array = document.location.search.substring(1).split('&'),
                theLength = param_array.length,
                params = {}, i = 0, x;

            for (; i < theLength; i++) {
                x = param_array[i].toString().split('=');
                params[x[0]] = x[1];
            }
            return params;
        }
        return {};
    }

    function buildQueryString(str, param, val) {
        // function returns string with str parameters plus the given parameter. works even param already exists in str
        var ind = str.indexOf('?');
        if (ind > -1) {
            var param_array = str.substring(ind + 1).split('&');
            var params = {};
            var theLength = param_array.length;
            for (var i = 0; i < theLength; i++) {
                var x = param_array[i].toString().split('=');
                params[x[0]] = x[1];
            }
            params[param] = val;
            var attached = "?";
            for (var key in params) {
                attached += key + "=" + params[key] + "&";
            } attached = attached.substr(0, attached.length - 1);
            return String(str.substr(0, ind) + attached);
        } return String(str + "?" + param + "=" + val);
    }

    function mirrorAppFunctions(obj, properties) {
        var keys, newKey;

        properties.forEach(function (prop) {
            keys = Object.keys(obj[prop]);

            keys.forEach(function (key) {
                if (key.indexOf('App') !== -1) {
                    newKey = key.replace('App', 'Web');
                    obj[prop][newKey] = obj[prop][key];
                }
            });
        });

        return obj;
    }

    //#region ----------------------------------------------------------- private (not exposed) 
    /**
     * the rest and jsom objects have methods that are мот exposed 
	 * and are used only by the spyreqs.rest / spyreqs.jsom methods
     */
    rest = {
        createList: function (url, list) {
            var data = {
                "__metadata": {
                    type: "SP.List"
                },
                BaseTemplate: list.Template,
                Title: list.Title
            };
            return createAsync(url, data);
        },
        addListField: function (url, field, fieldType) {
            field.__metadata = {
                type: (typeof fieldType !== 'undefined') ? fieldType : 'SP.Field'
            };
            return createAsync(url, field);
        }
    };
    jsom = {
        createListFields: function (context, SPlist, fieldsObj) {
            var field, defer, result;

            field = fieldsObj.shift();
            createListField();

            function createListField() {
                var xmlStr, choice, attr;

                if (typeof defer === 'undefined') {
                    defer = new $.Deferred();
                }
                if (typeof field.Type === 'undefined') {
                    field.Type = "Text";
                }
                if (typeof field.DisplayName === 'undefined') {
                    field.DisplayName = field.Name;
                }
                if (field.Type !== 'Lookup') {
                    xmlStr = '<Field ';
                    for (attr in field) {
                        if (attr !== 'choices') {
                            xmlStr += attr + '="' + field[attr] + '" ';
                        }
                    }
                    xmlStr += '>';
                    if (field.Type === 'Choice') {
                        xmlStr += '<CHOICES>';
                        field.choices.forEach(function (choice) {
                            xmlStr += '<CHOICE>' + choice + '</CHOICE>';
                        });
                        xmlStr += '</CHOICES>';
                    }
                    xmlStr += '</Field>';
                } else {
                    xmlStr += '';
                }
                result = SPlist.get_fields().addFieldAsXml(xmlStr, true, SP.AddFieldOptions.defaultValue);
                context.load(SPlist);
                context.executeQueryAsync(success, fail);
            }

            function success() {
                if (fieldsObj.length > 0) {
                    field = fieldsObj.shift();
                    createListField();
                } else {
                    defer.resolve(result);
                }
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        createList: function (c, listObj) {
            var web, theList, listCreationInfo, template, field, defer = new $.Deferred(), val_temp, fn_temp, isValidAttrBool,
				lciAttrs = [
					"url", "description", "documentTemplateType",
					"customSchemaXml", "dataSourceProperties",
					"quickLaunchOption", "templateFeatureId"
				],
				listAttrs = [
					"contentTypesEnabled", "defaultContentApprovalWorkflowId",
					"defaultDisplayFormUrl", "defaultEditFormUrl",
					"defaultNewFormUrl", "documentTemplateUrl",
					"draftVersionVisibility", "enableAttachments",
					"enableFolderCreation", "enableMinorVersions",
					"enableModeration", "enableVersioning",
					"forceCheckout", "hidden", "isApplicationList",
					"isSiteAssetsLibrary", "multipleDataList",
					"noCrawl", "onQuickLaunch", "validationFormula",
					"validationMessage", "direction"
				];

            web = c.appContextSite.get_web();
            listCreationInfo = new SP.ListCreationInformation();

            if (typeof listObj.title === 'undefined') {
                say('createList cannot create without .title');
                var args = {
                    get_message: function () { return "createList cannot create without .title"; },
                    get_stackTrace: function () { return null; }
                };
                setTimeout(fail(null, args), 500);
                return defer.promise();
            }
            listCreationInfo.set_title(listObj.title);

            if (typeof listObj.template === 'undefined') {
                template = SP.ListTemplateType.genericList;
            } else if (isNaN(listObj.template)) {
                template = SP.ListTemplateType[listObj.template];
            } else {
                template = listObj.template;
            }
            listCreationInfo.set_templateType(template);

            // set any other attribute of listCreationInformation from listObject	
            for (var attr in listObj) {
                val_temp = listObj[attr];
                fn_temp = "set_" + attr;
                if (typeof listCreationInfo[fn_temp] == 'function') {
                    listCreationInfo[fn_temp](val_temp);
                }
            }
            theList = web.get_lists().add(listCreationInfo);

            // set any other attribute of list from listObject	
            for (var attr in listObj) {
                val_temp = listObj[attr];
                fn_temp = "set_" + attr;
                if (listAttrs.indexOf(attr) > -1) {
                    theList[fn_temp](val_temp);
                }
            }
            theList.update();

            c.context.load(theList);
            c.context.executeQueryAsync(success, fail);

            function success() {
                // add fields
                if (listObj.fields) {
                    // start creating fields
                    $.when(jsom.createListFields(c.context, theList, listObj.fields)).then(
						function (data) {
						    // create List Fields finished
						    defer.resolve(listObj);
						},
						function (error) {
						    defer.reject(error);
						}
					);
                } else {
                    // no fields to create
                    defer.resolve(listObj);
                }
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        addListItem: function (c, listTitle, itemObj) {
            var web, theList, theListItem, prop, itemCreateInfo, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            itemCreateInfo = new SP.ListItemCreationInformation();
            theListItem = theList.addItem(itemCreateInfo);
            for (prop in itemObj) {
                theListItem.set_item(prop, itemObj[prop]);
            }
            theListItem.update();
            c.context.load(theListItem);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(theListItem.get_id());
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        getListFields: function (c, listTitle) {
            var web, theList, listFields, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            listFields = theList.get_fields();
            c.context.load(theList);
            c.context.load(listFields);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(listFields);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getItems: function (c, listTitle, query) {
            var web, theList, resultCollection, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            var camlQuery = new SP.CamlQuery();
            camlQuery.set_viewXml(query);
            resultCollection = theList.getItems(camlQuery);
            c.context.load(resultCollection);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(resultCollection);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        updateListItem: function (c, listTitle, itemObj, itemId) {
            var web, theList, theListItem, prop, itemId, itemCreateInfo, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);

            theListItem = theList.getItemById(itemId);
            for (prop in itemObj) {
                theListItem.set_item(prop, itemObj[prop]);
            }
            theListItem.update();
            c.context.load(theListItem);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(itemId);
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        recycleListItem: function (c, listTitle, itemId) {
            var web, theList, theListItem, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);

            theListItem = theList.getItemById(itemId);
            theListItem.recycle();
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(itemId);
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        checkList: function (c, listTitle) {
            var web, collectionList, defer = new $.Deferred();

            if (!c) {
                // SP.ClientContext not loaded, c is null
                var args = {
                    get_message: function () { return "SP.ClientContext not loaded"; },
                    get_stackTrace: function () { return null; }
                };
                setTimeout(fail(null, args), 500);
                return defer.promise();
            }

            web = c.appContextSite.get_web();
            collectionList = web.get_lists();
            // this will only load Title, no other list properties
            c.context.load(collectionList, 'Include(Title)');
            c.context.executeQueryAsync(success, fail);

            function success() {
                var listInfo = '',
					answerBool = false,
					listEnumerator = collectionList.getEnumerator();

                while (listEnumerator.moveNext()) {
                    var oList = listEnumerator.get_current();
                    if (oList.get_title() == listTitle) {
                        answerBool = true;
                        break;
                    }
                }
                // say("check list: " + listTitle + ": " + answerBool);
                defer.resolve(answerBool);
            }

            function fail(sender, args) {
                var error = { sender: sender, args: args };
                defer.reject(error);
            }

            return defer.promise();
        },
        removeRecentElemByTitle: function (c, elemTitle, literalsArray) {
            var defer = new $.Deferred();

            // if no literalsArray is provided, avoid error
            literalsArray = literalsArray || ["Recent"];
            // if literalsArray is a string, turn it into array
            if (!(literalsArray instanceof Array)) literalsArray = [literalsArray];

            function success() {
                var msg = 'element removed from Recent: ' + elemTitle;
                defer.resolve(msg);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            c.ql = c.appContextSite.get_web().get_navigation().get_quickLaunch();
            var ql = c.ql; // extra-worried about multi calls...
            c.context.load(ql);
            c.context.executeQueryAsync(
                function () {
                    var objEnumerator = ql.getEnumerator(), navItem, recentsFoundBool, navItemTitle;
                    while (objEnumerator.moveNext()) {
                        navItem = objEnumerator.get_current();
                        navItemTitle = navItem.get_title();
                        if ($.inArray(navItemTitle, literalsArray) !== -1) {
                            // was:  if (navItem.get_title() == "Recent") {  but would not work except for English SP sites
                            // so, we found 'Recent' node, get its children
                            recentsFoundBool = true;
                            var ch = navItem.get_children();
                            c.context.load(ch);
                            c.context.executeQueryAsync(
                                function () {
                                    var childsEnum = ch.getEnumerator(), childItem, foundBool = false;
                                    while (childsEnum.moveNext()) {
                                        childItem = childsEnum.get_current();
                                        if (childItem.get_title() == elemTitle) {
                                            foundBool = true;
                                            childItem.deleteObject();
                                            c.context.load(ql);
                                            c.context.executeQueryAsync(
                                                success,
                                                fail
                                            );
                                            break;
                                        }
                                    }
                                    if (!foundBool) {
                                        var args = {
                                            get_message: function () { return "Recent Element was not found: " + elemTitle; },
                                            get_stackTrace: function () { return null; }
                                        };
                                        setTimeout(fail(null, args), 500);
                                    }
                                },
                                fail
                            );
                        }
                    }
                    if (!recentsFoundBool) {
                        var args = {
                            get_message: function () { return "Recent Node was not found: " + elemTitle; },
                            get_stackTrace: function () { return null; }
                        };
                        setTimeout(fail(null, args), 500);
                    }
                },
                fail
            );

            return defer.promise();
        },
        getList: function (c, listTitle) {
            var web, theList, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            c.context.load(theList);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(theList);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getLists: function (c, columns) {
            var web, lists, columnArg, defer = $.Deferred();

            web = c.appContextSite.get_web();
            lists = web.get_lists();

            if (typeof columns === 'string') {
                columnArg = "Include(" + columns + ")";
            } else if (Array.isArray(columns)) {
                columnArg = "Include(" + columns.join() + ")";
            }

            if (columnArg) {
                c.context.load(lists, columnArg);
            } else {
                c.context.load(lists);
            }

            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(lists);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }
            return defer.promise();
        },
        deleteList: function (c, listTitle) {
            var web, theList, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            theList.deleteObject();
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(listTitle + " deleted");
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        recycleList: function (c, listTitle) {
            var web, theList, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            theList.recycle();
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(listTitle + " recycled");
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getListPermissions: function (c, listTitle, userName) {
            var web, theList, userPerms, defer = new $.Deferred();
            // userName sample: i:0#.f|membership|g.panoutsopoulos@inedulms.com
            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);
            userPerms = theList.getUserEffectivePermissions(userName);
            c.context.load(theList, 'EffectiveBasePermissions');
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(userPerms);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getListItemHasUniquePerms: function (c, listTitle, itemIdOrFilename) {
            var web, theList, queryStr, resultCollection,
		        defer = new $.Deferred(),
                camlQuery = new SP.CamlQuery();

            web = c.appContextSite.get_web();
            theList = web.get_lists().getByTitle(listTitle);

            if (!isNaN(itemIdOrFilename)) {
                queryStr = "<View><Query><Where><Eq><FieldRef Name='ID'/><Value Type='Counter'>"
                            + itemIdOrFilename + "</Value></Eq></Where></Query></View>";
            } else {
                queryStr = "<View><Query><Where><Eq><FieldRef Name='FileLeafRef'/><Value Type='File'>"
                           + itemIdOrFilename + "</Value></Eq></Where></Query></View>";
            }

            camlQuery.set_viewXml(queryStr);
            var resultCollection = theList.getItems(camlQuery);

            c.context.load(resultCollection, "Include(Title, DisplayName, HasUniqueRoleAssignments)");
            c.context.executeQueryAsync(success, fail);

            function success() {
                var answerBool, itemTitle, listEnumerator = resultCollection.getEnumerator();

                while (listEnumerator.moveNext()) {
                    // normally we expect only one row
                    var oListItem = listEnumerator.get_current();
                    answerBool = oListItem.get_hasUniqueRoleAssignments();
                }

                defer.resolve(answerBool);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getAllListsHasUniquePerms: function (c) {
            var web, theList, defer = new $.Deferred(), collectionList;

            web = c.appContextSite.get_web();
            collectionList = web.get_lists();
            c.context.load(collectionList, 'Include(Title, HasUniqueRoleAssignments)');
            c.context.executeQueryAsync(success, fail);

            function success() {
                var listInfo = '', answerBool, title, resultsArray = [],
                    listEnumerator = collectionList.getEnumerator();

                while (listEnumerator.moveNext()) {
                    var tempObj, oList = listEnumerator.get_current();
                    tempObj = {
                        title: oList.get_title(),
                        hasUniqePerms: oList.get_hasUniqueRoleAssignments()
                    };
                    resultsArray.push(tempObj);
                }

                defer.resolve(resultsArray);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getListHasUniquePerms: function (c, listTitle) {
            var web, theList, defer = new $.Deferred(), collectionList;

            web = c.appContextSite.get_web();
            collectionList = web.get_lists();
            c.context.load(collectionList, 'Include(Title, HasUniqueRoleAssignments)');
            c.context.executeQueryAsync(success, fail);

            function success() {
                var listInfo = '', answerBool = -1, listEnumerator = collectionList.getEnumerator();

                while (listEnumerator.moveNext()) {
                    var oList = listEnumerator.get_current();
                    if (oList.get_title() == listTitle) {
                        answerBool = oList.get_hasUniqueRoleAssignments();
                        break;
                    }
                }

                if (answerBool == -1) {
                    var args = {
                        get_message: function () { return "List was not found: " + elemTitle; },
                        get_stackTrace: function () { return null; }
                    };
                    fail(null, args);
                }
                else {
                    defer.resolve(answerBool);
                }
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        getCurrentUser: function (c) {
            var defer = new $.Deferred();
            user = c.context.get_web().get_currentUser();
            c.context.load(user);
            c.context.executeQueryAsync(success, fail);

            function success() {
                defer.resolve(user);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();

        },
        getWebProperty: function (c, propName, storageObjName) {
            var web, properties, val, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            properties = web.get_allProperties();
            web.update();
            c.context.load(web);
            c.context.load(properties);
            c.context.executeQueryAsync(success, fail);

            function success() {
                // store SP object in spyreqs
                // this will also overwite the 'isUnloaded' property
                webPropertiesStorage[storageObjName] = properties.get_fieldValues();
                // get the asked value
                var val = webPropertiesStorage[storageObjName][propName];
                defer.resolve(val);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        setWebProperty: function (c, propName, val, storageObjName) {
            var web, properties, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            properties = web.get_allProperties();
            properties.set_item(propName, val);
            web.update();
            c.context.load(web);
            c.context.executeQueryAsync(success, fail);

            function success(obj) {
                webPropertiesStorage[storageObjName][propName] = val;
                defer.resolve(obj);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        deleteFile: function (c, fileServerRelativeUrl) {
            // Please note: if file is not found, success will still be invoked
            var web, file, defer = new $.Deferred();

            web = c.appContextSite.get_web();
            file = web.getFileByServerRelativeUrl(fileServerRelativeUrl);
            c.context.load(web);
            file.deleteObject();
            c.context.executeQueryAsync(success, fail);

            function success(obj) {
                defer.resolve(obj);
            }

            function fail(sender, args) {
                var error = {
                    sender: sender,
                    args: args
                };
                defer.reject(error);
            }

            return defer.promise();
        },
        createFile: function (c, doclib, fname, body, overwriteBool) {
            var web, theLib, fileCreateInfo, newFile, defer = new $.Deferred();
            web = c.appContextSite.get_web();
            theLib = web.get_lists().getByTitle(doclib);

            fileCreateInfo = new SP.FileCreationInformation();
            fileCreateInfo.set_url(fname);
            fileCreateInfo.set_content(new SP.Base64EncodedByteArray());
            // do not overwrite if bool is not defined
            fileCreateInfo.set_overwrite(overwriteBool || false);

            var converted_arr = strToUTF8Arr(body);
            for (var i = 0; i < converted_arr.length; ++i) {
                fileCreateInfo.get_content().append(converted_arr[i]);
            }
            newFile = theLib.get_rootFolder().get_files().add(fileCreateInfo);
            c.context.load(newFile);
            c.context.executeQueryAsync(successHandler, errorHandler);

            function successHandler() { defer.resolve(newFile.get_serverRelativeUrl()); }

            function errorHandler(sender, args) { defer.reject(args.get_message()); }

            function strToUTF8Arr(sDOMStr) {
                var aBytes, nChr, nStrLen = sDOMStr.length, nArrLen = 0;
                /* mapping... */
                for (var nMapIdx = 0; nMapIdx < nStrLen; nMapIdx++) {
                    nChr = sDOMStr.charCodeAt(nMapIdx);
                    nArrLen += nChr < 0x80 ? 1 : nChr < 0x800 ? 2 : nChr < 0x10000 ? 3 : nChr < 0x200000 ? 4 : nChr < 0x4000000 ? 5 : 6;
                }
                aBytes = new Uint8Array(nArrLen);
                /* transcription... */
                for (var nIdx = 0, nChrIdx = 0; nIdx < nArrLen; nChrIdx++) {
                    nChr = sDOMStr.charCodeAt(nChrIdx);
                    if (nChr < 128) {
                        /* one byte */
                        aBytes[nIdx++] = nChr;
                    } else if (nChr < 0x800) {
                        /* two bytes */
                        aBytes[nIdx++] = 192 + (nChr >>> 6);
                        aBytes[nIdx++] = 128 + (nChr & 63);
                    } else if (nChr < 0x10000) {
                        /* three bytes */
                        aBytes[nIdx++] = 224 + (nChr >>> 12);
                        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
                        aBytes[nIdx++] = 128 + (nChr & 63);
                    } else if (nChr < 0x200000) {
                        /* four bytes */
                        aBytes[nIdx++] = 240 + (nChr >>> 18);
                        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
                        aBytes[nIdx++] = 128 + (nChr & 63);
                    } else if (nChr < 0x4000000) {
                        /* five bytes */
                        aBytes[nIdx++] = 248 + (nChr >>> 24);
                        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
                        aBytes[nIdx++] = 128 + (nChr & 63);
                    } else /* if (nChr <= 0x7fffffff) */ {
                        /* six bytes */
                        aBytes[nIdx++] = 252 + /* (nChr >>> 32) is not possible in ECMAScript! So...: */ (nChr / 1073741824);
                        aBytes[nIdx++] = 128 + (nChr >>> 24 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 18 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 12 & 63);
                        aBytes[nIdx++] = 128 + (nChr >>> 6 & 63);
                        aBytes[nIdx++] = 128 + (nChr & 63);
                    }
                }
                return aBytes;
            }

            return defer.promise();
        }
    };
    //#endregion ----------------------------------------------------------- private (not exposed)  

    spyreqs = {
        //#region ----------------------------------------------------------- spyreqs.rest
        rest: {
            executeHostCommand: function (command) {
                // sample: spyreqs.rest.executeHostCommand("web/lists(guid'8c68a641-452b-4bc3-bb1c-0f3dec720103')?").then(say,say)
                var url = baseUrl + command + targetStr;
                return getAsync(url);
            },
            executeAppCommand: function (url) {
                var url = appUrl + command;
                return getAsync(url);
            },
            getHostLists: function (query) {
                /**
                 * gets the Lists of the host Site
                 * @param  {string} query [the query to execute example:"$filter=..."]
                 * example of using the function
                 * spyreqs.rest.getHostLists("$select=...").then(function(data){//doSomething with the data},function(error){//handle the error});
                 */
                var url = baseUrl + "web/lists?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppLists: function (query) {
                var url = appUrl + "/_api/web/lists?" + checkQuery(query);
                return getAsync(url);
            },
            getHostListByTitle: function (listTitle, query) {
                /**
                * gets a List from the Host Site by the Title of the List
                * @param  {string} listTitle [the Title of the List]
                * @param  {string} query     [the query to execute]
                */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppListByTitle: function (listTitle, query) {
                /**
                 * gets the Items of a List from the Host Site
                 * @param  {string} listTitle [The Title of the List]
                 * @param  {string} query     [the query to execute]
                 */
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')?" + checkQuery(query);
                return getAsync(url);
            },
            getHostListItems: function (listTitle, query) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppListItems: function (listTitle, query) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items?" + checkQuery(query);
                return getAsync(url);
            },
            getHostListFields: function (listTitle, query) {
                /**
                 * gets the Fields of a List form the Host Site
                 * @param  {string} listTitle [The Title of the List ]
                 * @param  {string} query     [the query to execute]
                 */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Fields?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getAppListFields: function (listTitle, query) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Fields?" + checkQuery(query);
                return getAsync(url);
            },
            createHostList: function (list) {
                /**
                * create a List at the Host Site
                * @param  {object} list [the list to create. Must have the properties 'Template' and 'Title']
                */
                var url = baseUrl + "web/lists?" + targetStr;
                return rest.createList(url, list);
            },
            createAppList: function (list) {
                var url = appUrl + "/_api/web/lists?";
                return rest.createList(url, list);
            },
            addHostListItem: function (listTitle, item) {
                /**
                * adds an item to a Host List
                * @param {string} listTitle [The Title of the List]
                * @param {object} item      [the item to create. Must have the properties Title and __metadata.
                * __metadata must be an object with property type and value "SP.Data.LessonsListItem"]
                */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items?" + targetStr;
                return createAsync(url, item);
            },
            addAppListItem: function (listTitle, item) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items?";
                return createAsync(url, item);
            },
            deleteHostListItem: function (listTitle, itemId, etag) {
                /**
                * deletes an item from List from the Host Site
                * @param  {string} listTitle [The Title of the List]
                * @param  {string} itemId    [the id of the item]
                * @param  {string} etag      [the etag value of the item's __metadata object]
                */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")?" + targetStr;
                return deleteAsync(url, etag);
            },
            deleteAppListItem: function (listTitle, itemId, etag) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")?";
                return deleteAsync(url, etag);
            },
            updateHostList: function (list) {
                //list must have Title, Id and __metadata with property type 
                var url = baseUrl + "web/lists/getByTitle('" + list.Title + "')?" + targetStr;
                return updateAsync(url, list);
            },
            updateHostListItem: function (listTitle, item) {
                /**
                 * updates an item in a Host List
                 * @param  {string} listTitle [the title of the Host List]
                 * @param  {object} item      [the item to update. Must have the properties Id and __metadata]       
                 * var item = {
                 *   "__metadata": {
                 *       type: "SP.Data.DemodemoListItem",
                 *       etag:""//optional
                 *   },
                 *   Id:".."//guid is mandatory
                 *   //all columns you want to update
                 *   Title: "item",
                 *   NotEditable:"edited"
                * };
                 */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + item.Id + ")?" + targetStr;
                return updateAsync(url, item);
            },
            updateAppListItem: function (listTitle, item) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Items(" + item.Id + ")?";
                return updateAsync(url, item);
            },
            updateHostListField: function (listTitle, field) {
                /* updateHostListField field object example
                *    var field = {
                *        ReadOnly:false,
                *        // more properties here
                *        Id:"...", // this is the fields guid, requiered
                *        __metadata:{
                *            type:"SP.Field" // requiered
                *            // may add etag 
                *        }
                *   };
                */
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Fields(guid'" + field.Id + "')?" + targetStr;
                return updateAsync(url, field);
            },
            updateAppListField: function (listTitle, field) {
                var url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/Fields(guid'" + field.Id + "')?";
                return updateAsync(url, field);
            },
            addHostListField: function (listGuid, field, fieldType) {
                /**
                 * adds a field to a Host List
                 * @param {string} listGuid [the guid of the list]
                 * @param {object} field    [the field to add]
                 * @param {string} fieldType [otional fieldType.If not provided defaults to SP.Field]
                 * field must have the properties :
                 *      'Title': 'field title',
                 *      'FieldTypeKind': FieldType value,{int}
                 *      'Required': true/false,
                 *      'EnforceUniqueValues': true/false,
                 *      'StaticName': 'field name'
                 * information about FieldTypeKind :
                 *     http://msdn.microsoft.com/en-us/library/microsoft.sharepoint.client.fieldtype.aspx
                 */
                var url = baseUrl + "web/lists(guid'" + listGuid + "')/Fields?" + targetStr;
                return rest.addListField(url, field, fieldType);
            },
            addAppListField: function (listGuid, field, fieldType) {
                var url = appUrl + "/_api/web/lists(guid'" + listGuid + "')/Fields?";
                return rest.addListField(url, field, fieldType);
            },
            getCurrentUser: function () {
                var url = baseUrl + "/web/CurrentUser?" + targetStr;
                return getAsync(url);
            },
            getHostFile: function (fileUrl) {
                var url = baseUrl + "web/GetFileByServerRelativeUrl('" + fileUrl + "')/$value?" + targetStr;
                return getFile(url);
            },
            getAppFile: function (fileUrl) {
                var url = appUrl + "/_api/web/GetFileByServerRelativeUrl('" + fileUrl + "')/$value?";
                return getFile(url);
            },
            getHostFolderFiles: function (folderName) {
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Files?" + targetStr;
                return getAsync(url);
            },
            getHostFolderFolders: function (folderName) {
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Folders?" + targetStr;
                return getAsync(url);
            },
            getAppFolderFiles: function (folderName) {
                var url = appUrl + "/_api/web/GetFolderByServerRelativeUrl('" + folderName + "')/Files?";
                return getAsync(url);
            },
            getAppFolderFolders: function (folderName) {
                var url = appUrl + "/_api/web/GetFolderByServerRelativeUrl('" + folderName + "')/Folders?";
                return getAsync(url);
            },
            addHostFolder: function (documentLibrary, folderName) {
                /**
                 * creates a Folder To a Host Document Librry
                 * @param {string} documentLibrary [the Name of the Document Library to which the Folder should be added]
                 * @param {string} folderName      [the Name of the Folder]
                 */
                var url = baseUrl + "web/folders?" + targetStr,
                    folderName = documentLibrary + "/" + folderName,
                    data = {
                        '__metadata': {
                            'type': 'SP.Folder'
                        },
                        'ServerRelativeUrl': folderName
                    };

                return addFolder(url, data);
            },
            addHostFile: function (folderName, fileName, file) {
                var url = baseUrl + "web/GetFolderByServerRelativeUrl('" + folderName + "')/Files/Add(url='" + fileName + "',overwrite=true)?" + targetStr;
                return addFile(url, file);
            },
            addAppFile: function (folderName, fileName, file) {
                var url = appUrl + "/_api/web/GetFolderByServerRelativeUrl('" + folderName + "')/Files/Add(url='" + fileName + "',overwrite=true)?";
                return addFile(url, file);
            },
            getHostListItemAttachments: function (listTitle, itemId) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")/AttachmentFiles?" + targetStr;
                return getAsync(url);
            },
            addHostListItemAttachment: function (listTitle, itemId, fileName, file) {
                var url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/Items(" + itemId + ")/AttachmentFiles/add(FileName='" + fileName + "')?" + targetStr;
                return createAsync(url, file);
            },
            getSiteUsers: function (query) {
                /**
                 * gets the Users of the Site
                 * @param  {string} query [the query to execute e.g. "$filter=Email ne ''"] 
                 * @return {[type]}       [description]
                 */
                var url = baseUrl + "web/SiteUsers?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            breakRoleInheritanceOfHostList: function (listTitle, copyRolesStr, clearSubScopeStr) {
                var defer = new $.Deferred(), copyRolesStr = copyRolesStr || "true", clearSubScopeStr = clearSubScopeStr || "false",
                    url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/breakroleinheritance(copyRoleAssignments =" + copyRolesStr + ",clearSubscopes =" + clearSubScopeStr + ")?" + targetStr;
                return postAsync(url);
            },
            breakRoleInheritanceOfAppList: function (listTitle, copyRolesStr, clearSubScopeStr) {
                var defer = new $.Deferred(), copyRolesStr = copyRolesStr || "true", clearSubScopeStr = clearSubScopeStr || "false",
                    url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/breakroleinheritance(copyRoleAssignments =" + copyRolesStr + ",clearSubscopes =" + clearSubScopeStr + ")?";
                return postAsync(url);
            },
            resetRoleInheritanceOfAppList: function (listTitle) {
                var defer = new $.Deferred(),
                    url = appUrl + "/_api/web/lists/getByTitle('" + listTitle + "')/resetroleinheritance?";
                return postAsync(url);
            },
            resetRoleInheritanceOfHostList: function (listTitle) {
                var defer = new $.Deferred(),
                    url = baseUrl + "web/lists/getByTitle('" + listTitle + "')/resetroleinheritance?" + targetStr;
                return postAsync(url);
            },
            givePermissionToGroupToAppList: function (listTitle, permissionName, groupName) {
                var groupId;

                return this.breakRoleInheritanceOfAppList(listTitle)
                    .then(function () {
                        //get the Id of the Group
                        var url = appUrl + "/_api/web/sitegroups/getByName('" + groupName + "')?$select=Id";
                        return getAsync(url);
                    })
                    .then(function (groupData) {
                        //delete roleassignments for this group  
                        var url;
                        groupId = groupData.d.Id;
                        url = appUrl + "/_api/web/lists/getbytitle('" + listTitle + "')/roleassignments/getbyprincipalid('" + groupId + "')";
                        return deleteAsync(url);
                    })
                    .then(function () {
                        //get the id of the new roleAssignment
                        var url = appUrl + "/_api/web/roledefinitions/getByName('" + permissionName + "')?select=Id";
                        return getAsync(url);
                    })
                    .done(function (permissionData) {
                        //give to the group in the List Scope the new roleAssignment
                        var url = appUrl + "/_api/web/lists/getbytitle('" + listTitle + "')/roleassignments/" +
                            "addroleassignment(principalid=" + groupId + ",roledefid=" + permissionData.d.Id + ")",
                            defer = new $.Deferred();

                        executor.executeAsync({
                            url: url,
                            method: 'POST',
                            headers: {
                                Accept: "application/json;odata=verbose"
                            },
                            success: defer.resolve,
                            error: defer.reject
                        });

                        return defer.promise();
                    });
            },
            getHostListRoleAssigmnent: function (listTitle, userId) {
                // only works with full control on host web
                var url = baseUrl + "web/lists/getbytitle('" + listTitle + "')/roleassignments/getbyprincipalid('" + userId + "')?" + targetStr;
                return getAsync(url);
            },
            breakRoleInheritanceOfHostWeb: function (copyRolesStr, clearSubScopeStr) {
                var defer = new $.Deferred(), copyRolesStr = copyRolesStr || "true", clearSubScopeStr = clearSubScopeStr || "false",
                    url = baseUrl + "web/breakroleinheritance(copyRoleAssignments =" + copyRolesStr + ",clearSubscopes =" + clearSubScopeStr + ")?" + targetStr;
                return postAsync(url);
            },
            breakRoleInheritanceOfAppWeb: function (copyRolesStr, clearSubScopeStr) {
                var defer = new $.Deferred(), copyRolesStr = copyRolesStr || "true", clearSubScopeStr = clearSubScopeStr || "false",
                    url = appUrl + "/_api/web/breakroleinheritance(copyRoleAssignments =" + copyRolesStr + ",clearSubscopes =" + clearSubScopeStr + ")?";
                return postAsync(url);
            },
            resetRoleInheritanceOfHostWeb: function () {
                var defer = new $.Deferred(),
                    url = baseUrl + "web/resetroleinheritance?" + targetStr;
                return postAsync(url);
            },
            resetRoleInheritanceOfAppWeb: function () {
                var defer = new $.Deferred(),
                    url = appUrl + "/_api/web/resetroleinheritance?";
                return postAsync(url);
            },
            postAsync: postAsync,
            getAsync: getAsync
        },
        //#endregion ----------------------------------------------------------- spyreqs.rest
        //#region ----------------------------------------------------------- spyreqs.jsom
        jsom: {
            checkHostList: function (listTitle) {
                // This function checks if list.Title exists.
                /* syntax example: 
                spyreqs.jsom.checkHostList( "listTitle" ).then(
                    function(listExistsBool) { alert(listExistsBool); // true or false },
                    function(error) { alert('checkHostList request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */
                var c = newRemoteContextInstance();
                // if SP.ClientContext is not loaded, c will be null. 
                // But, send the promise and let disolve there
                return jsom.checkList(c, listTitle);
            },
            checkAppList: function (listTitle) {
                /* syntax example: see checkHostList */
                var c = newLocalContextInstance();
                // if SP.ClientContext is not loaded, c will be null. 
                // But, send the promise and let disolve there
                return jsom.checkList(c, listTitle);
            },
            getCurrentUser: function () {
                var c = newLocalContextInstance();
                return jsom.getCurrentUser(c);
            },
            getHostList: function (listTitle) {
                var c = newRemoteContextInstance();
                return jsom.getList(c, listTitle);
            },
            getAppList: function (listTitle) {
                var c = newLocalContextInstance();
                return jsom.getList(c, listTitle);
            },
            getAppLists: function (columns) {
                var c = newLocalContextInstance();
                return jsom.getLists(c, columns);
            },
            getHostLists: function (columns) {
                var c = newRemoteContextInstance();
                return jsom.getLists(c, columns);
            },
            deleteHostList: function (listTitle) {
                var c = newRemoteContextInstance();
                return jsom.deleteList(c, listTitle);
            },
            deleteAppList: function (listTitle) {
                var c = newLocalContextInstance();
                return jsom.deleteList(c, listTitle);
            },
            recycleHostList: function (listTitle) {
                var c = newRemoteContextInstance();
                return jsom.recycleList(c, listTitle);
            },
            recycleAppList: function (listTitle) {
                var c = newLocalContextInstance();
                return jsom.recycleList(c, listTitle);
            },
            getAppListPermissions: function (listTitle, userName) {
                var c = newLocalContextInstance();
                return jsom.getListPermissions(c, listTitle, userName);
            },
            getHostListPermissions: function (listTitle, userName) {
                // only works with full control on host web
                say("CAUTION, spyreqs says: getHostListPermissions only works with full control on host web");
                var c = newRemoteContextInstance();
                return jsom.getListPermissions(c, listTitle, userName);
            },
            getAppListFields: function (listTitle) {
                var c = newLocalContextInstance();
                return jsom.getListFields(c, listTitle);
            },
            getHostListFields: function (listTitle) {
                var c = newRemoteContextInstance();
                return jsom.getListFields(c, listTitle);
            },
            getHostListItems: function (listTitle, query) {
                /* Example syntax:								
				spyreqs.jsom.getHostListItems("myClasses","<View><Query><Where><IsNotNull><FieldRef Name='ClassGuid'/></IsNotNull></Where></Query></View>").then(
					function(resultCollection) { 
						var listItemEnumerator = resultCollection.getEnumerator(), out=" ";
						while (listItemEnumerator.moveNext()) {
							var oListItem = listItemEnumerator.get_current();
							out += oListItem.get_item('ClassStudentGroupID');
						}	
						alert(out);
					},
					function(error) { alert('getAppListItems request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
				 ); 
				*/
                var c = newRemoteContextInstance();
                return jsom.getItems(c, listTitle, query);
            },
            getAppListItems: function (listTitle, query) {
                /* Example syntax: see spyreqs.jsom.getHostListItems	 */
                var c = newLocalContextInstance();
                return jsom.getItems(c, listTitle, query);
            },
            addHostListItem: function (listTitle, itemObj) {
                /* example: 
                spyreqs.jsom.addHostListItem("My List", {"Title":"my item", "Score":90}).then(
                    function(itemId) { alert("item was added, id:"+itemId); },
                    function(error) { alert('addHostListItem request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */
                var c = newRemoteContextInstance();
                return jsom.addListItem(c, listTitle, itemObj);
            },
            addAppListItem: function (listTitle, itemObj) {
                /* example: see addHostListItem example */
                var c = newLocalContextInstance();
                return jsom.addListItem(c, listTitle, itemObj);
            },
            updateAppListItem: function (listTitle, itemObj, itemId) {
                /* example: 
                spyreqs.jsom.updateAppListItem("My List", {"Title":"my item", "Score":90}, 9).then(
                    function(itemId) { alert("item was added, id:"+itemId); },
                    function(error) { alert('addHostListItem request failed. ' +  error.args.get_message() + '\n' + error.args.get_stackTrace() ); }
                );  
                */
                var c = newLocalContextInstance();
                return jsom.updateListItem(c, listTitle, itemObj, itemId);
            },
            updateHostListItem: function (listTitle, itemObj, itemId) {
                /* syntax example: see updateAppListItem example */
                var c = newRemoteContextInstance();
                return jsom.updateListItem(c, listTitle, itemObj, itemId);
            },
            recycleHostListItem: function (listTitle, itemId) {
                /* syntax example: see updateAppListItem example */
                var c = newRemoteContextInstance();
                return jsom.recycleListItem(c, listTitle, itemId);
            },
            recycleAppListItem: function (listTitle, itemId) {
                /* syntax example: see updateAppListItem example */
                var c = newLocalContextInstance();
                return jsom.recycleListItem(c, listTitle, itemId);
            },
            removeHostRecentElemByTitle: function (elemTitle, literalsArray) {
                // removes element from Host site Recent node, under QuickLaunch node. 
                var c = newRemoteContextInstance();
                return jsom.removeRecentElemByTitle(c, elemTitle, literalsArray);
            },
            removeAppRecentElemByTitle: function (elemTitle, literalsArray) {
                // removes element from Host site Recent node, under QuickLaunch node. 
                var c = newLocalContextInstance();
                return jsom.removeRecentElemByTitle(c, elemTitle, literalsArray);
            },
            createHostList: function (listObj) {
                /* please put all list attributes and listInformation attributes in listObj. 
					syntax example:
					spyreqs.jsom.createHostList({
						"title":app_MainListName,	 
						"url":app_MainListName, 
						"onQuickLaunch" : true,
						"hidden" : true,
						"description" : "this is a list", 
							fields : [	 
								{"Name":"userId", "Type":"Text", "Required":"true"},
								{"Name":"scoreFinal", "Type":"Number", "hidden":"true"},
								{"Name":"assginedTo", "Type":"User"},
								{"Name":"state", "Type":"Choice", "choices" : ["rejected", "approved", "passed", "proggress"]},
								{"Name":"comments", "Type":"Note"}
							]	 
						})
					.then( ...... )				
					field properties: http://msdn.microsoft.com/en-us/library/office/jj246815.aspx
				*/
                var c = newRemoteContextInstance();
                return jsom.createList(c, listObj);
            },
            createAppList: function (listObj) {
                /* syntax example: see createHostList example */
                var c = newLocalContextInstance();
                return jsom.createList(c, listObj);
            },
            createHostSite: function (webToCreate) {
                // NOT READY
                var web, webCreationInfo, newWeb;

                web = appContextSite.get_web();
                webCreationInfo = new SP.WebCreationInformation();
                webCreationInfo.set_title(webToCreate.Title);
                webCreationInfo.set_webTemplate(webToCreate.Template);
                webCreationInfo.set_url(webToCreate.Url);
                webCreationInfo.set_language(webToCreate.language);
                webCreationInfo.set_useSamePermissionsAsParentSite(webToCreate.inheritPerms);
                newWeb = web.get_webs().add(webCreationInfo);

                context.load(newWeb);
                context.executeQueryAsync(success, fail);

                function success() {
                    var result = newWeb.get_title() + ' created.';
                    alert(result);
                }

                function fail(sender, args) {
                    alert('Request failed. ' + args.get_message() +
                        '\n' + args.get_stackTrace());
                }
            },
            getHostListItemHasUniquePerms: function (listTitle, itemIdOrFilename) {
                var c = newRemoteContextInstance();
                return jsom.getListItemHasUniquePerms(c, listTitle, itemIdOrFilename);
            },
            getAppListItemHasUniquePerms: function (listTitle, itemIdOrFilename) {
                var c = newLocalContextInstance();
                return jsom.getListItemHasUniquePerms(c, listTitle, itemIdOrFilename);
            },
            getAllHostListsHasUniquePerms: function () {
                var c = newRemoteContextInstance();
                return jsom.getAllListsHasUniquePerms(c);
            },
            getAllAppListsHasUniquePerms: function () {
                var c = newLocalContextInstance();
                return jsom.getAllListsHasUniquePerms(c);
            },
            getHostListHasUniquePerms: function (listTitle) {
                var c = newRemoteContextInstance();
                return jsom.getListHasUniquePerms(c, listTitle);
            },
            addUserToRoleTypeInAppWeb: function (userOrUserId, SPRoleType) {
                var
                    deferred = $.Deferred(),
                    c = new newLocalContextInstance(),
                    context = c.appContextSite,
                    web = context.get_web(),
                    assignments = web.get_roleAssignments(),
                    roleAssignments,
                    user, roleTypeDefinition,
                    //create a new RoleDefinitionBindingCollection
                    newBindings = SP.RoleDefinitionBindingCollection.newObject(context)
                ;

                if (userOrUserId instanceof SP.User) {
                    userOrUserId = userOrUserId.get_id();
                }
                user = web.getUserById(userOrUserId);

                //get the user from the web so as to be in the same context
                roleTypeDefinition = web.get_roleDefinitions().getByType(SPRoleType);

                //add the roleType
                newBindings.add(roleTypeDefinition);
                roleAssignments = assignments.add(user, newBindings);

                context.executeQueryAsync(
                    function () {
                        deferred.resolve(true);

                    }, function (sender, args) {
                        var error = { sender: sender, args: args };
                        deferred.reject(error);
                    });

                return deferred.promise();
            },
            addUserToRoleTypeInAppList: function (userOrUserId, SPRoleType, listTitle) {
                // add userId to SPRoleType ( inherit for ListTitle	must be broke already )	 
                var
                    deferred = $.Deferred(),
                    c = new newLocalContextInstance(),
                    context = c.appContextSite,
                    web = context.get_web(),
                    //get the list
                    SPListObj = web.get_lists().getByTitle(listTitle),
                    // Get the RoleAssignmentCollection for the target list
                    assignments = SPListObj.get_roleAssignments(),
                    user,
                    roleTypeDefinition,
                    roleAssignment,
                    newBindings = SP.RoleDefinitionBindingCollection.newObject(context)
                ;

                if (userOrUserId instanceof SP.User) {
                    userOrUserId = userOrUserId.get_id();
                }

                user = web.getUserById(userOrUserId);
                roleTypeDefinition = web.get_roleDefinitions().getByType(SPRoleType);

                // Add the role to the collection
                newBindings.add(roleTypeDefinition);

                // Add the user to the target list and assign the use to the new RoleDefinitionBindingCollection
                roleAssignment = assignments.add(user, newBindings);

                context.executeQueryAsync(
                    function () {
                        deferred.resolve(true);
                    },
                    function (sender, args) {
                        var error = { sender: sender, args: args };
                        deferred.reject(error);
                    }
                );
                return deferred.promise();
            },
            addUserToRoleTypeInAppListItem: function (userOrUserId, SPRoleType, listTitle, itemId) {
                var
                    deferred = $.Deferred(),
                    c = new newLocalContextInstance(),
                    context = c.appContextSite,
                    web = context.get_web(),
                    // Get the RoleAssignmentCollection for the target list
                    SPListItemObj = web.get_lists().getByTitle(listTitle).getItemById(itemId),
                    assignments = SPListItemObj.get_roleAssignments(),
                    roleAssignment, user,
                    roleDefOfRoleType = web.get_roleDefinitions().getByType(SPRoleType),
                    // Create a new RoleDefinitionBindingCollection
                    newBindings = SP.RoleDefinitionBindingCollection.newObject(context);

                // Add the role to the collection
                newBindings.add(roleDefOfRoleType);

                if (userOrUserId instanceof SP.User) {
                    userOrUserId = userOrUserId.get_id();
                }

                user = web.getUserById(userId);

                // Add the user to the target list and assign the use to the new RoleDefinitionBindingCollection
                roleAssignment = assignments.add(user, newBindings);

                context.executeQueryAsync(
                    function () {
                        deferred.resolve(true);
                    },
                    function (sender, args) {
                        var error = { sender: sender, args: args };
                        deferred.reject(error);
                    }
                );

                return deferred.promise();

            },
            getAppListHasUniquePerms: function (listTitle) {
                var c = newLocalContextInstance();
                return jsom.getListHasUniquePerms(c, listTitle);
            },
            getTestAppContext: function () {
                var c = newLocalContextInstance();
                c.getter = c.appContextSite;
                c.loader = c.context;
                return c;
            },
            getTestHostContext: function () {
                var c = newRemoteContextInstance();
                c.getter = c.appContextSite;
                c.loader = c.context;
                return c;
            },
            getHostProperty: function (propName) {
                if (webPropertiesStorage["hostWebProperties"].isUnloaded) {
                    var c = newRemoteContextInstance();
                    return jsom.getWebProperty(c, propName, "hostWebProperties");
                } else {
                    // get the val from the stored obj and resolve the promise at once
                    var val = webPropertiesStorage["hostWebProperties"][propName];
                    return new $.Deferred().resolve(val).promise();
                }
            },
            getAppProperty: function (propName) {
                if (webPropertiesStorage["appWebProperties"].isUnloaded) {
                    var c = newLocalContextInstance();
                    return jsom.getWebProperty(c, propName, "appWebProperties");
                } else {
                    // get the val from the stored obj and resolve the promise at once
                    var val = webPropertiesStorage["appWebProperties"][propName];
                    return new $.Deferred().resolve(val).promise();
                }
            },
            setHostProperty: function (propName, val) {
                var c = newRemoteContextInstance();
                return jsom.setWebProperty(c, propName, val, "hostWebProperties");
            },
            setAppProperty: function (propName, val) {
                var c = newLocalContextInstance();
                return jsom.setWebProperty(c, propName, val, "appWebProperties");
            },
            createAppFile: function (doclib, fname, body, overwriteBool) {
                var c = newLocalContextInstance();
                return jsom.createFile(c, doclib, fname, body, overwriteBool);
            },
            createHostFile: function (doclib, fname, body, overwriteBool) {
                var c = newRemoteContextInstance();
                return jsom.createFile(c, doclib, fname, body, overwriteBool);
            },
            deleteAppFile: function (fileServerRelativeUrl) {
                var c = newLocalContextInstance();
                return jsom.deleteFile(c, fileServerRelativeUrl);
            },
            deleteHostFile: function (fileServerRelativeUrl) {
                var c = newRemoteContextInstance();
                return jsom.deleteFile(c, fileServerRelativeUrl);
            }
        },
        //#endregion ----------------------------------------------------------- spyreqs.jsom
        //#region ----------------------------------------------------------- spyreqs.utils
        utils: {
            urlParamsObj: urlParamsObj,
            buildQueryString: buildQueryString,
            say: say,
            getRegionalSettings: function (query) {
                /**
             * gets the Site's Regional Settings like DateFormat,DateSeparator,LocaleId...
             * @param  {string} query [optional query]
			 * example: getRegionalSettings("$select=DateSeperator,LocaleId");			 
             */
                var url = baseUrl + "/web/RegionalSettings?" + checkQuery(query) + targetStr;
                return getAsync(url);
            },
            getQueryParams: function () {
                return queryParams;
            },
            getAppUrl: function () {
                return appUrl;
            },
            getHostUrl: function () {
                return hostUrl;
            },
            setAppUrl: function (param) {
                appUrl = param;
            },
            setHostUrl: function (param) {
                hostUrl = param;
            },
            startMyTimer: function () {
                return performance.now();
            },
            getMyTimer: function (tima) {
                return performance.now() - tima;
            }
        },
        //#endregion ----------------------------------------------------------- spyreqs.utils
        version: function () { say("Hello, spyreqs ver " + spyreqs_version); }
    };

    // liberate scope...
    if (notAnApp_FlagSum == 2) {
        // spyreqs is not loaded from an app
        window.spyreqs = mirrorAppFunctions(spyreqs, ['rest', 'jsom', 'utils']);
    } else {
        window.spyreqs = spyreqs;
    }
}(window));

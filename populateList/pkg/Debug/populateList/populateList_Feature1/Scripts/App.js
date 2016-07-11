'use strict';
var say = say || function sayFn(what) { console.log(what); },
    startMyTimer = startMyTimer || spyreqs.utils.startMyTimer,
    getMyTimer = getMyTimer || spyreqs.utils.getMyTimer,
    publicData = {
        selectedListName: "",
        burnAmmount: 0,
        lookupsInfo: {},
        personsInfo: {},
        working: ""
    },
    app_version = "1.0.1.6"; 

var log = function logFn(what) {
    $("#logger").html($("#logger").html() + what + "<br/>");
}
log("Populate a List, version " + app_version);

var notify = function notifyFn(what, isLoading, isSticky) {
    if (isLoading) {
        return SP.UI.Notify.showLoadingNotification(what);
    } else {
        return SP.UI.Notify.addNotification(what, isSticky);
    }
}

var ngApp = angular.module('ngApp', [])
    .controller('appCtrl', appCtrl)
	.factory('utils', utils)
	.factory('dataManager', dataManager);

//#region ----------------------- UI
$(".myDataTable").hide();
$("#autoSelectBtn").hide();
$("#visitListHref").hide();
$("#burnProgressLabel").hide();

$("#closeModalBtn").click(
    function () { utils().hideModal(); }
);

$("#clearModalBtn").click(
    function () { $("#logger").html("ready"); }
);

$("#showModalBtn").click(
    function () { utils().showModal(); }
);

//#endregion 

function dataManager($q) {
    return {
        getLists : function getListsFn () {
            return $q.when(spyreqs.rest.getHostLists("$select=Title,Description,Id"));
        },
        getListFields : function getListFieldsFn () {
            return $q.when(spyreqs.rest.getHostListFields(publicData.selectedListName, ""));
        },
        getListFieldsForLookups: function getListFieldsForLookups() {
            return $q.when(spyreqs.jsom.getHostListFields(publicData.selectedListName));
        },
        findGroupsLike: function (literalArray) { 
	        // tries to find the names of groups Visitors, Members, Owners
	        literalArray = literalArray || ['Visitors', 'Members', 'Owners'];
            if (typeof literalArray === 'string') literalArray = [literalArray];

            var c = spyreqs.jsom.getTestHostContext(),
		        theWeb = c.appContextSite.get_web(),
		        collGroup = theWeb.get_siteGroups(),
		        foundGroups = [], matchingGroups = [], 
		        defer = $q.defer();
 
            c.context.load(theWeb);
            c.context.load(collGroup);	 
            c.context.executeQueryAsync(onGetUserQuerySucceeded, onGetUserQueryFailed);
	
            function onGetUserQuerySucceeded() {         
                var groupEnumerator = collGroup.getEnumerator(), oGroup;

                while (groupEnumerator.moveNext()) {
                    oGroup = groupEnumerator.get_current();
                    foundGroups.push(oGroup.get_title());
                }
	
                matchingGroups = foundGroups.filter(lookForLiteral);		
                defer.resolve(matchingGroups);
            }

            function onGetUserQueryFailed(sender, args) {
                say("Get findGroupsLike Failed.   --- " + args.get_message() + "\n" + args.get_stackTrace());
                defer.reject(args);
            }

            function lookForLiteral(item) {
                var passMatch = function passMatchFn(literalItem) {
                    if (item.toLowerCase().indexOf(literalItem.toLowerCase()) > -1) return true;
                    return false;
                }
                if (literalArray.some(passMatch)) return true;
                return false;
            }
	
            return defer.promise;
        },
        getPromiseUserIdsFromGroups: function (groupsNamesArray) {
            /* get an array of user groups titles and returns in promise 
	           an object of two arrays, userIds and userNames */
            say("groups to read: ");
            say(groupsNamesArray);
            // ---------------------------------------------------------------------
            var c = spyreqs.jsom.getTestHostContext(),
		        theWeb = c.appContextSite.get_web(),
		        collGroup = theWeb.get_siteGroups(),
		        foundGroups = [], userCollections = [],
		        groups = groupsNamesArray,
		        uIds = [], uNames = [],
		        defer = $q.defer();
		 
            if (groups.length > 0) {
                c.context.load(theWeb);
                c.context.load(collGroup);
		
                $.each(groups, function (index, group) {
                    foundGroups.push(collGroup.getByName(group));
                    c.context.load(foundGroups[index]);
                    userCollections.push(foundGroups[index].get_users());
                    c.context.load(userCollections[index]);
                });

                c.context.executeQueryAsync(onGetUserQuerySucceeded, onGetUserQueryFailed);		
            } else {
                say("getPromiseUserIdsFromGroups says: no groups in the given array");
                setTimeout(defer.resolve, 0);
            }

            function onGetUserQuerySucceeded() { 
                $.each(userCollections, function (index, userCol) {
                    var userEnumerator = userCol.getEnumerator(), oUser;

                    while (userEnumerator.moveNext()) {
                        oUser = userEnumerator.get_current();                 
                        uIds.addUnique(oUser.get_id());               
                    }
                }); 
                say("userIDs: ");
                say(uIds);
                defer.resolve(uIds);
            }

            function onGetUserQueryFailed(sender, args) {
                say("Get getPromiseUserIdsFromGroups Failed.   --- " + args.get_message() + "\n" + args.get_stackTrace());
                defer.reject(args);
            }

            return defer.promise;
        }
    } 
}

function utils() {
    return { 
        ruleOut: function (rows, filterObj) {
            var validate = function validateFn(row) {
                for (var field in filterObj) {
                    var val = row[field];
                    if (val) {
                        // one of the unwanted properties exist in row item, check the value now
                        if (filterObj[field].indexOf(val) > -1) {
                            // we should rule out this row
                            return false;
                        }
                    }
                }
                return true;
            };
            var returnedArray = rows.filter(validate);
            return returnedArray;            
        },
        showModal: function () {
            $("#modal").show();
        },
        hideModal: function () {
            $("#modal").hide();
        },
        sayFail: function (err) {
            say("Error: "); say(err);
            var er = "Sorry, an error occured. " + err.args.get_message();
            log(er)
            var stickyErrMsg = notify(er, false);
        },
        showTestBurnBtn: function () {
            $("#testBurnBtn").show();
            $("#burnBtn").hide();
        },
        showBurnBtn: function () {           
            $("#testBurnBtn").hide();
            $("#burnBtn").show();
        },
        hideUpdateBtns: function () {
            $("#getFieldsBtn").hide();
            $("#autoSelectBtn").hide();
            $("#visitListHref").hide();
        },
        showUpdateBtns: function () {
            $("#getFieldsBtn").show();
            $("#visitListHref").show();            
        },
        showUpdatePromisesReadyBtns: function () {
            $("#autoSelectBtn").show();
        }
    };
}

var updateBurnIndicator = function updateBurnIndicatorFn(ammount) {
    $("#burnProgressLabel").text(ammount + "/" + publicData.burnAmmount)
}

function appCtrl($scope, utils, dataManager, $q) {

    utils.hideModal();
        
    var assumeDefaultDataEntryMethod = function assumeDefaultDataEntryMethodFn(whichObjArr) {
        say("assuming data entry methods");
        var rows = $scope[whichObjArr];
        var findDefault = function getDefaultFn(row) {
            var lookFor = row.FieldTypeKind;
            var mySettingsObjArr = $scope.autoFillOptions.filter(function (option) {
                if (option.defaultFor == lookFor) return true;
                return false;
            });
            if (mySettingsObjArr.length > 0) row.suggestedSettingItem = mySettingsObjArr[0];
            
            return row;
        };
        // find the suggested selection and attach .suggestedOrder to row obj
        $scope[whichObjArr] = rows.map(findDefault);
        // flag for 'done'
        $scope.assumeDone = true;
    }

    var autoSelectDataEntryMethod = function autoSelectDataEntryMethodFn(whichObjArr) {
        if (!$scope.assumeDone) assumeDefaultDataEntryMethod(whichObjArr);
        say("auto select called");
        var selectDefault = function selectDefaultFn(row) {
            if (row.suggestedSettingItem) {
                row.selectAutoFillData = row.suggestedSettingItem;
                // run 'on change' event
                $scope.getSelectedDataEntryMethod(row);
            }
            if (row.Required === true) {
                row.ngSelected = true;
            }
        }
        // auto-select the .suggestedSettingItem
        $scope[whichObjArr].map(selectDefault);

    }

    var prepareLookups = function prepareLookupsFn(whichObjArr) {
        var wait = notify("Loading lookup fields information...", false);
        var rows = $scope[whichObjArr], lookupRows = [], usefullLookupsArr = [];

        var storeLookups = function storeLookupsFn() {
            log("found " + usefullLookupsArr.length + " lookup Fields, loading all possible values");
            var fetchAllColumnValues = function fetchAllColumnValuesFn(itemObj) {
                log("getting values for " + itemObj.lookupField + " of list " + itemObj.lookupList);
                var command = "web/lists(guid'" + itemObj.lookupList.slice(1, -1) + "')/Items?$select=ID," + itemObj.lookupField;
                publicData.lookupsInfo[itemObj.fieldTitle] = [];
                var copyToPublicData = function copyToPublicDataFn(item) {
                    //publicData.lookupsInfo[itemObj.fieldTitle].push(item[itemObj.lookupField]);
                    // we need ID to burn lookup in the list later, as id;#string
                    var objToPush = {
                        title: item[itemObj.lookupField],
                        id: item.ID
                    };
                    publicData.lookupsInfo[itemObj.fieldTitle].push(objToPush);
                    publicData.tempTitlesString += objToPush.title + ", ";
                    utils.showUpdatePromisesReadyBtns();
                }
                $q.when(spyreqs.rest.executeHostCommand(command)).then(
                    function (restData) {
                        publicData.tempTitlesString = "";
                        var results = restData.d.results;
                        results.map(copyToPublicData);
                        log("Values for " + itemObj.fieldTitle + ": " + publicData.tempTitlesString);
                    },
                    utils.sayFail
                );
            }

            usefullLookupsArr.map(fetchAllColumnValues);
            SP.UI.Notify.removeNotification(wait);
        }

        dataManager.getListFieldsForLookups().then(
            function (spFieldsCollection) {
                var fieldEnumerator = spFieldsCollection.getEnumerator(), lookupFound = false;
                while (fieldEnumerator.moveNext()) {
                    var oField = fieldEnumerator.get_current();
                    var fTitle = oField.get_title();
                    var fType = oField.get_typeAsString();
                    var fTypeNum = oField.get_fieldTypeKind();
                    if (fTypeNum == 7) {
                        if (!oField.get_readOnlyField() && !oField.get_hidden()) {
                            // it's not a system lookup so push it
                            lookupFound = true;
                            usefullLookupsArr.push({
                                fieldTitle: fTitle,
                                lookupField: oField.get_lookupField(),
                                lookupList: oField.get_lookupList()
                            });
                        }
                    }
                }
                if (lookupFound) { storeLookups();} else {utils.showUpdatePromisesReadyBtns();}
            },
			utils.sayFail
        );
    }

    var prepareGroups = function prepareGroups(row) { 
        // get an Array out of "['val','val']" string
        var groupsToFindArray = eval(row.dataEntryText);
        var defer = $q.defer();
        
        var gotIds = function (arrReturned) { 
            row["selectAutoFillData"].fnName = "getRandomChoice";            
            row["hiddenFnParams"] = "[" + arrReturned.toString() + "]";
            defer.resolve();
        }

        $q.when(dataManager.findGroupsLike(groupsToFindArray)).
           then(dataManager.getPromiseUserIdsFromGroups).
           then(gotIds, say).
           catch(function () {
               defer.reject();
           })

        return defer.promise;
    }

    var getSelectedRows = function getSelectedRowsFn(theArray) {
        var isSelected = function isSelectedFn(item) {
            return item.ngSelected === true;
        };
        return theArray.filter(isSelected);
    }

    var getUnSelectedRows = function getUnSelectedRowsFn(theArray) {
        var isUnSelected = function isUnSelectedFn(item) {
            return item.ngSelected !== true;
        };
        return theArray.filter(isUnSelected);
    }

    var getItemDefinition = function getItemDefinitionFn(whichObjArr) {
        var itemDefinition = {};
        var selectedRows = getSelectedRows($scope[whichObjArr]);
        var getFieldOptions = function getFieldOptionsFn(item) {
            return {
                fieldTitle: item["InternalName"],
                fnName: item["selectAutoFillData"].fnName,
                fnParams: item["hiddenFnParams"] || item["dataEntryText"]
            };
        }
        var addPropInItemDefinition = function addPropInItemDefinitionFn(fieldOptionsItem) {
            
            if (fieldOptionsItem.fnName.length < 1) {
                // if no fnName (in case we want to burn static text), name it 'copy'. spyreqs_populateList will handle
                fieldOptionsItem.fnName = "copy";
                // wrap the string in quotes
                fieldOptionsItem.fnParams = "'" + fieldOptionsItem.fnParams + "'";
            }
            
            var command = fieldOptionsItem.fnName + "(" + fieldOptionsItem.fnParams + ")";
            itemDefinition[fieldOptionsItem.fieldTitle] = command;
        }

        var fieldOptions = selectedRows.map(getFieldOptions);
        fieldOptions.map(addPropInItemDefinition);

        say("item definition");
        say(itemDefinition);

        return itemDefinition;
    }

    var isLookupRow = function isLookupRowFn(row) {
        if (row.FieldTypeKind === 7) {
            return true;
        }
        return false;
    }

    var isPersonRow = function isPersonRowFn(row) {
        if (row.FieldTypeKind === 20) {
            return true;
        }
        return false;
    }

    $scope.updateTable = function updateTableFn(whichObjArr) {
        log("updating table for " + publicData.selectedListName + " list");
        $scope.assumeDone = false;
        $scope.ngAllSelected = false;
        utils.hideUpdateBtns();
        publicData.working = notify("", true);
        var wait = notify("Please wait while loading list fields", false);
        dataManager.getListFields().then(           
			function (restData) {
                // add to scope only the rows that pass validation with unwantedFieldsFilter object
			    $scope[whichObjArr] = utils.ruleOut(restData.d.results, settings.unwantedFieldsFilter);
			    SP.UI.Notify.removeNotification(wait);

			    if ($scope[whichObjArr].some(isLookupRow)) {
			        prepareLookups(whichObjArr);
			    } else {
			        utils.showUpdatePromisesReadyBtns();
			    }
			    //say("SPList object: "); say($scope[whichObjArr]);
			    $(".myDataTable").show();
			    utils.showUpdateBtns();

                // all systems go, so remove "Working on it" notify
			    SP.UI.Notify.removeNotification(publicData.working);
			},
			utils.sayFail
		);
        // build list url and show link
        prepListURL();
    }
    
    $scope.autoSelect = function autoSelectFn(whichObjArr) {
        autoSelectDataEntryMethod(whichObjArr);
    }
    
    $scope.deleteSelected = function deleteSelectedFn(whichObjArr) {
        var theArray = $scope[whichObjArr];
        if (theArray) {
            $scope[whichObjArr] = getUnSelectedRows($scope[whichObjArr]);
        }
    }
    
    $scope.burn = function burnFn(whichObjArr) {
        // collect information from selected rows and build the itemDefinition for the spyreqs_populateList
        var selectedRows = getSelectedRows($scope[whichObjArr]);
        if (selectedRows.some(isPersonRow)) {
            /*  before burn replace text of group names array with ids array, 
                and set the auto to Choice Custom
            */
            say("preparing person ids");
            var personRows = selectedRows.filter(isPersonRow);

            $q.all(personRows.map(prepareGroups)).then(go);

        } else { go(); }        

        function go() {
            publicData.working = notify("", true); // "working on it"
            publicData.burnWaitNotify = notify("Please wait while adding records", false);

            publicData.burnAmmount = $scope.burnAmmount;
            updateBurnIndicator(0);
            $("#burnBtn").hide();
            $(".burnProgressLabel").show();
       
            var itemDefinition = getItemDefinition(whichObjArr);
            say("itemDefinition: "); say(itemDefinition);
            window.populateList.settings.itemDefinition = itemDefinition;
            window.populateList.settings.burnTimes = $scope.burnAmmount;
            window.populateList.settings.listName = publicData.selectedListName;
            window.populateList.startBurn();
        }
    }

    $scope.testBurn = function burnFn(whichObjArr) {
        // collect information from selected rows and build the itemDefinition for the spyreqs_populateList
        var selectedRows = getSelectedRows($scope[whichObjArr]);
        if (selectedRows.some(isPersonRow)) {
            /*  before burn replace text of group names array with ids array, 
                and set the auto to Choice Custom
            */
            say("preparing person ids");
            var personRows = selectedRows.filter(isPersonRow);

            $q.all(personRows.map(prepareGroups)).then(goTest);

        } else { goTest(); }
        
        function goTest() {
            publicData.working = notify("", true); // "working on it"
            publicData.testBurnWaitNotify = notify("Please wait while adding one test record", false);
            log("Starting test burn")
            $("#testBurnBtn").hide();
            var itemDefinition = getItemDefinition(whichObjArr);
            say("itemDefinition: "); say(itemDefinition);
            window.populateList.settings.itemDefinition = itemDefinition;
            window.populateList.settings.burnTimes = 1;
            window.populateList.settings.listName = publicData.selectedListName;
            window.populateList.startBurn();
        }
    }

    $scope.getSelectedList = function getSelectedListFn(item) {
        publicData.selectedListName = item;
    };

    $scope.getSelectedDataEntryMethod = function getSelectedDataEntryMethodFn(row) {
        utils.showTestBurnBtn();
                
        var params = row.selectAutoFillData;
        row.label = params.label;
        row.dataEntryText = params.text;            

        if (row.label == "") {
            $(".configLabel" + row.Id).hide();
        } else {
            $(".configLabel" + row.Id).show();
        }

        if (row.dataEntryText == "") {
            $(".configText" + row.Id).hide();
        } else {
            $(".configText" + row.Id).show();
        }

        if (publicData.lookupsInfo[row.Title] && params.title == "Lookup") {
            var data = publicData.lookupsInfo[row.Title];
            var asArray = "[" + data.map(function (item) { return "'" + item.id + ";#" + item.title + "'" }).join(", ") + "]";
            row.label = "One of: " + asArray;
            row.dataEntryText = asArray;
            $(".configText" + row.Id).hide();
        } else if (params.title == "Choice of built-in choices") {
            if (row.Choices) {
                var asArray = "[" + row.Choices.results.map(function (item) { return "'" + item + "'" }).join(", ") + "]";
                row.label = "One of: " + asArray;
                row.dataEntryText = asArray;
                $(".configText" + row.Id).hide();
            }
        }

    }

    $scope.checkAll = function checkAllFn(whichObjArr) {
        angular.forEach($scope[whichObjArr], function (row) {
            row.ngSelected = $scope.ngAllSelected;
        });
    }

    var initSelectList = function initSelectListFn(whichSelect) {
        say('select init called for ' + whichSelect);
        dataManager.getLists().then(
			function (restData) {
			    $scope[whichSelect] = restData.d.results;
			},
			utils.sayFail
		);
    }

    var init = function initFn() {
        say('main controller init called');
        $scope.data_ListFieldsArr = [];
        $scope.burnAmmount = 50;
    }

    //#region settings 
    var settings = { 
        unwantedFieldsFilter: {
            ReadOnlyField: [true],
            TypeDisplayName: ["Computed"],
            InternalName: ["MetaInfo", "Order", "Attachments", "FileLeafRef"]
        }       
    }
    //#endregion

    //#region   $scope.autoFillOptions 
    $scope.autoFillOptions = [
        {
            title: "Static text",
            label: "Standard text to burn",
            text: "some static text",
            fnName: "",
            defaultFor: -1
        }, {
            title: "Word of n letters",
            label: "Letters ammount",
            text: "3",
            fnName: "getDummyString",
            defaultFor: 2
        }, {
            title: "Text of n words",
            label: "Words ammount",
            text: "3",
            fnName: "getDummyText",
            defaultFor: 3
        }, {
            title: "Number of n digits",
            label: "Digits ammount",
            text: "3",
            fnName: "getDummyNumber",
            defaultFor: 10
        }, {
            title: "Number in range",
            label: "Sample: [2, 12]",
            text: "[2, 12]",
            fnName: "getRandomInt",
            defaultFor: 9
        }, {
            title: "Choice of n custom choices",
            label: "Sample: ['single', 'married', 'complicated']",
            text: "['single', 'married', 'complicated']",
            fnName: "getRandomChoice",
            defaultFor: -1
        }, {
            title: "Choice of built-in choices",
            label: "[]",
            text: "",
            fnName: "getRandomChoice",
            defaultFor: 6
        }, {
            title: "Person",
            label: "Possible values: ['owners', 'members', 'visitors']",
            text: "['members']",
            fnName: "getRandomPerson",
            defaultFor: 20
        }, {
            title: "True/False",
            label: "",
            text: "",
            fnName: "getRandomTF",
            defaultFor: 8
        }, {
            title: "Lookup",
            label: "[]",
            text: "",
            fnName: "getRandomChoice",
            defaultFor: 7
        }, {
            title: "Date/Time",
            label: "['from', 'to'] Syntax: y/m/d",
            text: "['1999/12/30', '2020/12/30']",
            fnName: "getRandomDate",
            defaultFor: 4
        }, {
            title: "Guid-like string",
            label: "",
            text: "",
            fnName: "getGuidLike",
            defaultFor: 14
        }, {
            title: "Hex of n letters",
            label: "Letters ammount",
            text: "14",
            fnName: "getDummyHex",
            defaultFor: -1
        }
    ];
    //#endregion    

    init();
    initSelectList('data_Lists');
    
    Array.prototype.addUnique = function (value) {
        /**
         * pushes value to the array if it is not already there
         * @param {mixed} value the value to be pushed into the array
         * @return {bool} returns true of the item was pushed into the array
         */
        //
        if (this.indexOf(value) !== -1) {
            return false;
        }
        this.push(value);
        return true;
    }
}

function prepListURL() {
    return ;
    
    // this will NOT work, you are looking for a list inside the app...
    say("preparing list url");
    getList(publicData.selectedListName).then(getListUrl).then(
           function (urlString) {
               say('list url found: ' + urlString);
               log('list url found: ' + urlString);
               $("#visitListHref").prop('href',urlString);
               $("#visitListHref").show();
           }, utils.sayFail);

    function getList (listTitle) { 
        var defer = new $.Deferred();

        var clientContext = new SP.ClientContext.get_current();
        var web = clientContext.get_web();
        var theList = web.get_lists().getByTitle(listTitle);
        clientContext.load(theList);
        clientContext.executeQueryAsync(success, executefail);

        function success() {
            say('getList resolved');
            defer.resolve(theList);
        }

        function executefail(sender, args) {
            say('getList rejected');
            var error = {
                sender : sender,
                args : args
            };
            say(error);
            defer.reject(error);
        }

        return defer.promise(); 
    }

    function getListUrl (spList) { 
        say('loading list url');
        var defer = new $.Deferred();

        var clientContext = new SP.ClientContext.get_current();
        clientContext.load(spList, 'DefaultViewUrl');
        clientContext.executeQueryAsync(success, executefail);

        function success() {
            say('load list url resolved');
            defer.resolve(spList.get_defaultViewUrl());
        }

        function executefail(sender, args) {
            say('load list url rejected');
            var error = {
                sender : sender,
                args : args
            };
            say(error);
            defer.reject(error);
        }

        return defer.promise();
    }
}
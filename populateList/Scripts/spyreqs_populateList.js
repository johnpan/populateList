(function (window, spyreqs){
	var say = say || spyreqs.utils.say,
		startMyTimer = startMyTimer || spyreqs.utils.startMyTimer,
		getMyTimer = getMyTimer || spyreqs.utils.getMyTimer;
	
	var settings = { 
		listName: "",
		burnTimes: 100, 
		burnThreads: 5,
		itemDefinition: {}
	};
	var resultIds = [];

	var randomManager = {
	    copy: function (staticString) {
	        if (staticString) return staticString;
	        return "some value";
	    },
	    getRandomDate: function (fromToArr) {
            /*
	        input example fromToArr = ['1999/12/30', '2020/12/30']
	        */
            var from = fromToArr[0];
            var fromArr = from.split('/');
            var fromDate = new Date(fromArr[0], fromArr[1]-1, fromArr[2]).getTime();

            var to = fromToArr[1];		
            var toArr = to.split('/');
            var toDate = new Date(toArr[0], toArr[1]-1, toArr[2]).getTime();	
            return new Date(fromDate + Math.random() * (toDate - fromDate));	    
        },
	    getRandomChoice: function (arr) {
	        if (arr) {
	            return arr[Math.floor(Math.random() * arr.length)];
	        }
	        return "some choice";
	    },
	    getDummyNumber: function (digits) {
	        if (!digits) digits = 1;
	        var zeros = Math.pow(10, digits - 2);
	        return ((10 * (zeros)) + Math.floor(Math.random() * 90 * (zeros)));
	    },
	    getRandomInt: function (minMaxArr) {
	        return Math.floor(Math.random() * (minMaxArr[1] - minMaxArr[0] + 1)) + minMaxArr[0];
	    },
	    getDummyString: function (digits) {
	        var text = "", possible = "abcdefghijklmnopqrstuvwxyz";
	        for (var i = 0; i < digits; i++)
	            text += possible.charAt(Math.floor(Math.random() * possible.length));
	        return text;
	    },
	    getDummyHex: function (digits) {
	        var text = "", possible = "abcdef0123456789";
	        for (var i = 0; i < digits; i++)
	            text += possible.charAt(Math.floor(Math.random() * possible.length));
	        return text;
	    },
	    getDummyText: function (words) {
	        var text = "";
	        for (var i = 0; i < words; i++) {
	            letters = randomManager.getRandomInt([2, 8]);
	            text += randomManager.getDummyString(letters) + " ";
	        }
	        return text;
	    },
	    getRandomTF: function () {
	        return Math.random() < .5;
	    },
	    getGuidLike: function () {
	        function s4() {
	            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
	        }
	        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
	    },
	    getRandomPerson: function (groupsArr) { return 13; },
	    getRandomLookup: function (lookupsArr) {
	        return randomManager.getRandomChoice(lookupsArr);
	    }
	};

	var startBurn = function startBurnFn() {
		// add vast ammount of records
		burnAsynq (settings.burnTimes, settings.burnThreads);
	}	

	function burnAsynq (burnTimes, threads) {	
		var timaAsync = startMyTimer();	
		var itemToAdd, i, r, repeats = Math.floor(burnTimes/threads), sets=0, s, fails=0;	 

		if (repeats === 0) {
            // only one test record then
		    threads = 1;
		    repeats = 1;
		}

		for (s=0; s<repeats; s++) {
			burnMulti(s);
		}
		
		function itemFromItemDefinition(objDef) {
		    var obj = {};

		    for (var propt in objDef) {
                // i tried without eval, but randomManager seems not reachable
		        //obj[propt] = new Function("return randomManager." + objDef[propt])();
		        obj[propt] = eval("randomManager." + objDef[propt]);
		    }             
		    say("obj generated: "); say(obj); 
		    return obj;		    
		}

		function burnMulti(setNo) { 
			say ("new set started: "+setNo);
			var doneJobs=0;
			for (i=0; i<threads; i++) {		
			    itemToAdd = itemFromItemDefinition(settings.itemDefinition);
				// to do: add batch method to add list items
				spyreqs.jsom.addHostListItem(settings.listName, itemToAdd).then(
					function(obj){					
					    burnTimes--;
					    doneJobs++;
					    resultIds.push(obj);
                        // hide this log, causes browser to hang if many items to burn
					    //log("Done: thread:" + doneJobs + "/" + threads + " threadSet:" + setNo + "/" + repeats);

						if (doneJobs == threads) {
						    updateBurnIndicator(doneJobs);
						    say("set " + setNo + " is done");
							if (burnTimes - fails == 0) {
							    msg = "Asynq burn finished in: " + parseFloat(Math.round(getMyTimer(timaAsync)) / 1000).toFixed(2) + "seconds. Failures:" + fails
							    log(msg);
							    if (publicData.testBurnWaitNotify) {
                                    // burn was a test, now show burn Btn
							        SP.UI.Notify.removeNotification(publicData.testBurnWaitNotify);
							        publicData.testBurnWaitNotify = null;
							        var ready = notify("Test success, ready to burn multi", false, false);
							        utils().showBurnBtn();
							    } else if (publicData.burnWaitNotify) {
							        // burn is completed
							        say("look at window.populateList.resultIds for ids of the new items");
							        SP.UI.Notify.removeNotification(publicData.burnWaitNotify);
							        publicData.burnWaitNotify = null;
							        var ready = notify(msg, false, true);
							        utils().showBurnBtn();
							    }
							    SP.UI.Notify.removeNotification(publicData.working);
							}
						}
					},
					function (err) {
					    utils().sayFail(err);
					    utils().showTestBurnBtn();
					    log("Failed: " + "thread:" + doneJobs + "/" + threads + " threadSet:" + setNo + "/" + repeats +
                            "with error: " + err.args.get_message());
						fails++;
					}
				);
			}
		}	
	}

	var timaSync;
     	
    // expose 
	window.populateList = {
		settings: settings,
		startBurn: startBurn,
		resultIds: resultIds
	};

}(window, spyreqs))
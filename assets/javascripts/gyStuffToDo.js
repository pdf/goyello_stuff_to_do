/**
 * @author Michał Kluczka
 */

var stopWatches = new Hash();
var runningIssueID = null;
var pausedIssueID = null;

var Request = {
  resetRecording: function(issueID)
  {
    if(null == issueID)
    {
      issueID = runningIssueID;
    }

    if(null != issueID && confirm('Are you sure you want to discard currently recorded time?'))
    {
      stopWatches[issueID].reset();
      stopWatches[issueID].stop();
      runningIssueID = null;
      
      $('stopwatch[' + issueID + ']').innerHTML = '00:00:00';
      $('stopwatch[' + issueID + ']').hide();
      $('loggingBreakButton').hide();
      $('logTime_' + issueID).hide();
      $('reset_' + issueID).hide();
      $('start_' + issueID).show();
      $('issue_' + issueID).style.backgroundColor = '';
      
      new Ajax.Request('stuff_to_do/reset_recording', {
        asynchronous: true,
        method: 'post',
        parameters:"issue_id=" + issueID
      });
    }
    else
    {
      stopWatches[issueID].start();
    }
  },
  updateLogtimeEntry: function(issueID, fromLogIT)
  {
    if(null == issueID)
    {
      issueID = runningIssueID;
    }
    if(null != issueID)
    {
      var stopwatch = $('stopwatch[' + issueID + ']');

      if(null != stopwatch)
      {
        new Ajax.Request('stuff_to_do/issue_break', {
          asynchronous: false,
          method: 'post',
          parameters:"issue_id=" + issueID + "&spent_time=" +
          stopwatch.innerHTML + "&paused=" + (null != fromLogIT ? fromLogIT : false)
        });
      }
    }
  },
  
  createLogtimeEntry: function()
  {
    if(null != runningIssueID)
    {
      new Ajax.Request('stuff_to_do/issuePlay', {
        asynchronous: false,
        method: 'post',
        parameters:"issue_id=" + runningIssueID
      });
    }
  },
  
  moveToDoing: function(issueID)
  {
    new Ajax.Updater('content','/stuff_to_do/move_to_doing', {
      method: 'get',
      asynchronous: false,
      onComplete:function(){
        updateStopwatches();
        updateDoingIssuesState();
      },
      parameters:"issue_id=" + issueID
    })
  },
  moveToAvailable: function(issueID)
  {
    var startTime = stopwatchToArray(issueID);
    var confirmation = true ;
    if(startTime[0] != 0 || startTime[1] != 0 || startTime[2] != 0)
    {
      var wasPending = stopWatches[issueID].started;
      if(true == wasPending)
      {
        stopWatches[issueID].stop();
      }
      if(confirm('Are you sure you want to move this issue?\nAny time recorded will be discarded!') == false )
      {
        confirmation = false
        if(true == wasPending)
        {
          stopWatches[issueID].start();
        }
      }
    }
    if (confirmation != false)
    {
      stopLoggingTime(issueID);
      new Ajax.Updater('content', '/stuff_to_do/move_to_available', {
        method: 'get',
        asynchronous: false,
        onComplete:function(){
          stopWatches[issueID].reset();
          updateStopwatches();
          updateDoingIssuesState();
        },
        parameters:"issue_id=" + issueID
      })
    }
  },

  updateIssueSummary: function(issueID)
  {
    new Ajax.Updater('issue-summary_' + issueID, 'stuff_to_do/update_issue_summary',{
      method: 'post',
      asynchronous: true,
      parameters:"issue_id=" + issueID
    });
  },
  updatePaneSummary: function()
  {
    new Ajax.Updater('pane-summary', 'stuff_to_do/update_pane_summary', {
      method: 'post',
      asynchronous: true
    });
  },
  saveRecordedTime: function(form, action){
    if(true == validate_fields())
    {
      var issueID = $('issue_id').value;
  
      new Ajax.Request('/stuff_to_do/save_single_logtime_entry', {
        asynchronous:true,
        evalScripts:true,
        parameters:Form.serialize(form),
        onComplete: function(response)
        {
          var text = response.responseText;
          if(text == 'Success')
          {
            if(null != action)
            {
              startLogTime(pausedIssueID);

              if(pausedIssueID != issueID)
              {
                toggleButtonsOnBreak(issueID, true);
              }
              runningIssueID = pausedIssueID;
              pausedIssueID = null;
            }
            else
            {
              pausedIssueID = null;
              $('stopwatch[' + issueID + ']').hide();
              $('reset_' + issueID).hide();
              $('logTime_' + issueID).hide();
              $('loggingBreakButton').hide();
              $('start_' + issueID).show();
            }
            $('stopwatch[' + issueID + ']').innerHTML = '00:00:00';
            stopWatches[issueID].reset();
            gyModalbox.hide();
          }
          else
          {
            $('logtimediv').update(response.responseText)
            gyModalbox.updateHeight();
          }
        }
      });
    }
  }
}

function save_end_of_work_entries()
{
  var entries = $$('.end_of_work_entries');
  entries.each(function(entry){
    var issueID = entry.id.split('__')[1];

    if(entry.style.display != 'none')
    {
      var form = $('quicklog_form_' + issueID);
      new Ajax.Request('/stuff_to_do/save_single_logtime_entry', {
        asynchronous:true,
        evalScripts:true,
        parameters:Form.serialize(form),
        onComplete: function(response)
        {
          var text = response.responseText;
          if(text == 'Success')
          {
            var entries = $$('.end_of_work_entries');

            if(entries.length == 1)
            {
              window.location = '/stuff_to_do';
            }
            else if(entries.length > 1)
            {
              Element.remove($('end_of_work_entry__' + issueID));
            }
          }
          else
          {
            $('end_of_work_entry__' + issueID).update(response.responseText)
          }
        }
      });
    }
  })
}

function hide_element(element_id)
{
  if($(element_id) != null)
  {
    $(element_id).hide();
  }
}

function submitEndOfWork()
{
  if (validate_fields())
  {
    $('endOfWorkForm').submit();
  }
}

function moveToAvailable(issueID)
{
  var available = $('available');

  if(null != available)
  {
    available.appendChild($('issue_' + issueID));
  }

  $('start_' + issueID).hide();
  $('logTime_' + issueID).hide();
  $('reset_' + issueID).hide();
  $('stopwatch[' + issueID + ']').hide();
  $('moveToAvailable_' + issueID).hide();
  $('moveToDoing_' + issueID).show();
  saveOrder();
}

function moveToDoing(issueID)
{
  Request.moveToDoing(issueID);
//  saveOrder();
}

function validate_fields()
{
  var spent_time_fields = $$('.text_field');
  var activity_fields = $$('.select_field');
  var date_fields = $$('.date_field');
  var idRegexp = /id="([^"]+)"/;
  var validation_passed = true;

  date_fields.each(function(field){
    var id = $(field).innerHTML.match(idRegexp);
    if(null == id)
    {
      id = $(field).innerHTML.match(/id=([^\s]+)/gi);
      id = id.toString().replace(/^id=(.+)$/, "$1")
    }
    else
    {
      id = id[1]
    }

    field = $(id);
    var number = field.id.replace(/^.+_([0-9]+)_.+$/, "$1");
    
    if(!field.value.match(/^[0-9]*(\.?|,?)[0-9]?[0-9]$/gi))
    {
      $('spent_time_' + number + '_validation_failed').show();
      validation_passed = false;
    }
    else
    {
      $('spent_time_' + number + '_validation_failed').hide();
    }

  })

  spent_time_fields.each(function(field){
    var id = $(field).innerHTML.match(idRegexp);

    if(null == id)
    {
      id = $(field).innerHTML.match(/id=([^\s]+)/gi);
      id = id.toString().replace(/^id=(.+)$/, "$1")
    }
    else
    {
      id = id[1]
    //debugger;
    }

    field = $(id);
    var number = field.id.replace(/^.+_([0-9]+)_.+$/, "$1")
    //alert(number)
    if(!field.value.match(/^[0-9]*(\.?|,?)[0-9]?[0-9]$/gi))
    {
      $('spent_time_' + number + '_validation_failed').show();
      validation_passed = false;
    }
    else
    {
      $('spent_time_' + number + '_validation_failed').hide();
    }
  });

  activity_fields.each(function(field){
    var id = $(field).innerHTML.match(idRegexp);
    if(null == id)
    {
      id = $(field).innerHTML.match(/id=([^\s]+)/gi);
      id = id.toString().replace(/^id=(.+)$/, "$1")
    }
    else
    {
      id = id[1]
    }
    
    field = $(id);
    id = field.id.replace(/^logtime_entry_([0-9]+)_activity$/gi, "$1")
   
    if(field.value == '-1' || field.selectedIndex == 0)
    {
      $('activity_' + id + '_validation_failed').show();
      validation_passed = false;
    }
    else
    {
      $('activity_' + id + '_validation_failed').hide();
    }
  })

  if(gyModalbox.element != null)
  {
    gyModalbox.updateHeight();
  }
  
  return validation_passed;
}

function cancelSaving()
{
  if(pausedIssueID != null)
  {
    startLogTime(pausedIssueID);
  }
  
  gyModalbox.hide();
  pausedIssueID = null;
}

function updateDoingIssuesState()
{
  var issues = $$('.is_pending');
  if(null != issues)
  {
    issues.each(function(issue){
      var issueID = getIssueIdFromElem(issue);
      var startTime = stopwatchToArray(issueID);
      var isPending = false;

      if(null != $('stopwatch['+issueID+']'))
      {
        if(startTime[0] != 0 || startTime[1] != 0 || startTime[2] != 0){
          $('logTime_' + issueID).show();
          $('reset_' + issueID).show();
        }
      }

      isPending = $('pending_' + issueID);

      if(null != isPending)
      {
        isPending = new Boolean(parseInt(isPending.value));
      }

      if(stopWatches[issueID] == undefined)
      {
        stopWatches[issueID] = new Stopwatch(function(watch){
          var st = $('stopwatch[' + issueID + ']');
          if(null != st){
            st.update(watch.toString());
          }
        }, 1, startTime, isPending);
      }

      if(true == isPending)
      {
        $('start_' + issueID).hide();
        $('loggingBreakButton').show();
        $('logTime_' + issueID).show();
        $('reset_' + issueID).show();

        runningIssueID = issueID;
      }
      else if(trim($('stopwatch[' + issueID + ']').innerHTML) != '00:00:00')
      {
        $('logTime_' + issueID).show();
        $('reset_' + issueID).show();
      }

      if(true == isPending && stopWatches[issueID] != undefined)
      {
        stopWatches[issueID].start();
      }
    });
  }
  attachSortables()
}

/**
 * Check if issue with given id is currently running
 */
function isRunning(issueID)
{
  var issue = $(issueID) ? $(issueID) : $('pending_' + issueID);
  return parseInt(trim($('pending_' + $(issue).id.replace(/^pending_(.+)$/gi, "$1")).value)) == 1;
}

/**
 * Retrieve issue id from element id
 */
function getIssueIdFromElem(elem)
{
  return $(elem).id.replace(/^.+_(.+)$/gi, "$1");
}
/**
 * Called when user clicked break button,
 * or started logging time for another issue
 */
function stopLoggingTime(issueID, fromLogIT)
{
  if(null == issueID)
  {
    issueID = runningIssueID;
  }
  
  toggleButtonsOnBreak(issueID, fromLogIT);
  Request.updateLogtimeEntry(issueID, fromLogIT);
  runningIssueID = null;
}


/**
 *
 */
function toggleButtonsOnBreak(issueID, fromLogIT)
{
  if(null == issueID)
  {
    issueID = runningIssueID
  }
    
  if(null != issueID){
    if(null != $('start_' + issueID))
    {
      if(!Element.visible('start_' + issueID) && null == fromLogIT)
      {
        $('start_' + issueID).show();
      }

      stopWatches[issueID].stop();
    }

    if(null == fromLogIT){
      $('issue_' + issueID).style.backgroundColor = '';
      $('loggingBreakButton').hide();
      if(trim($('stopwatch[' + issueID + ']').innerHTML) == '00:00:00')
      {
        $('stopwatch[' + issueID + ']').hide();
        $('reset_' + issueID).hide();
        $('logTime_' + issueID).hide();
      }
    }
    else if(fromLogIT == true)
    {
      if(pausedIssueID != issueID)
      {
        $('stopwatch[' + issueID + ']').hide();
        $('reset_' + issueID).hide();
        $('logTime_' + issueID).hide();
      }
    }
  }
}

/*
 * TODO Zmodyfikować wyrażenia regularne,
 * żeby łapały odpowiednio godziny i minuty,
 * zamiast minut i sekund
 */
function stopwatchToArray(issueID)
{
  var stopwatchTime = $('stopwatch[' + issueID + ']').innerHTML;

  var hours = stopwatchTime.replace(/([0-9][0-9]):[0-9][0-9]:[0-9][0-9]/gi, "$1");
  if(hours[0] == '0')
  {
    hours = hours[1];
  }

  var minutes = stopwatchTime.replace(/[0-9][0-9]:([0-9][0-9]):[0-9][0-9]/gi, "$1");
  if(minutes[0] == '0')
  {
    minutes = minutes[1];
  }

  var seconds = stopwatchTime.replace(/[0-9][0-9]:[0-9][0-9]:([0-9][0-9])/gi, "$1");
  if(seconds[0] == '0')
  {
    seconds = seconds[1];
  }

  var retValue = new Array(parseInt(hours), parseInt(minutes), parseInt(seconds))

  return retValue;
}

function stopwatchToFloat(issueID)
{
  var arr = stopwatchToArray(issueID);

  return arr[0] + parseInt((arr[1]/60)*10) / 10.0;
}

/**
 * Start time logging
 */
function startLogTime(issueID)
{
  if(issueID != null)
  {
    if(null != runningIssueID && runningIssueID != issueID)
    {
      stopLoggingTime();
    }
  
    runningIssueID = issueID;
    $('issue_' + issueID).setStyle({
      backgroundColor: '#d3d3d3'
    })

    if(null != $('start_' + issueID))
    {
      $('start_' + issueID).hide();
      $('loggingBreakButton').show();
      $('logTime_' + issueID).show();
      $('reset_' + issueID).show();
      $('stopwatch[' + issueID + ']').show();
    }
    Request.createLogtimeEntry();
    stopWatches[issueID].start();
  }
}

/**
 * Called when End of work is clicked
 */
function endOfWork()
{
  var timers = $$('.stopwatch_span');
  var noTimeRecorded = true;
  if(null != timers && timers.length > 0)
  {
    timers.each(function(timer){
      if(trim($(timer).innerHTML) != '00:00:00')
      {
        noTimeRecorded = false;
      }
    })
  }

  if(noTimeRecorded)
  {
    alert("There is no time recorded. You have nothing to save.");
  }
  else
  {
    window.location = '/stuff_to_do/end_of_work';
  }
}

/*
 *
 */
function assignToMe(issueID)
{
  var issueDiv = $('unassigned_issue_' + issueID);
  var available = $('available');

  available.appendChild(issueDiv);
  $('moveToAvailable_' + issueID).hide();
  $('moveToDoing_' + issueID).show();
}

/**
 *
 */
function issueLogTime(issueID)
{
  var logtimeDiv = $('logtimediv');
  
  new Ajax.Updater('logtimediv', 'stuff_to_do/retrieve_issue_for_quicklog', {
    method: 'get',
    asynchronous: true,
    evalScripts: true,
    onComplete:function(){
      var opt = {
        opacity: 0.02,
        width: 520
      };
      var issueBlock = $('issue_' + issueID)
      if(null != issueBlock)
      {
        opt.left = issueBlock.cumulativeOffset()['left'];
        opt.top = issueBlock.cumulativeOffset()['top'] + issueBlock.getHeight() - $('doing-now').scrollTop;
      }
      
      pausedIssueID = runningIssueID;
      if(runningIssueID == issueID)
      {
        if(null != $('saveAndCloseButton'))
        {
          $('saveAndCloseButton').show();
        }

        stopLoggingTime(issueID, true);
      }
      else
      {
        if(null != $('saveAndCloseButton'))
        {
          $('saveAndCloseButton').hide();
        }

        stopLoggingTime(pausedIssueID, true);
      }
      
      gyModalbox.show(logtimeDiv, opt);
    },
    parameters:"issue_id=" + issueID
  });

}

/*
 *
 */
function saveTimeAndStop(form)
{
  //Request.saveRecordedTime(form);

  if(validate_fields())
  {
    stopLoggingTime(pausedIssueID);
    Request.saveRecordedTime(form);
    pausedIssueID = null;
  }
}

// X-Browser isArray(), including Safari
function isArray(obj) {
  return obj.constructor == Array;
}

/**
 *
 */
function updateStopwatches()
{
  var issues = $$('.is_pending');
  if(null != issues)
  {
    issues._each(function(issue){
      var issueID = getIssueIdFromElem(issue);
      if(null != stopWatches[issueID])
      {
        stopWatches[issueID].stop();
      }
    })
    stopWatches = new Hash();
    issues._each(function(issue){
      var issueID = getIssueIdFromElem(issue);
      var startTime = stopwatchToArray(issueID);
      var isPending = false;

      if(null != $('stopwatch['+issueID+']'))
      {
        if(startTime[0] != 0 || startTime[1] != 0 || startTime[2] != 0){
          if(editable != false)
          {
            $('logTime_' + issueID).show();
            $('reset_' + issueID).show();
          }
          else
          {
            $('logTime_' + issueID).hide();
            $('reset_' + issueID).hide();
          }
        }
        else
        {
          $('logTime_' + issueID).hide();
          $('reset_' + issueID).hide();
        }
      }

      isPending = $('pending_' + issueID);

      if(null != isPending)
      {
        isPending = new Boolean(parseInt(isPending.value));
      }

      if(true == isPending)
      {
        if(true == editable)
        {
          $('start_' + issueID).hide();
          $('loggingBreakButton').show();
          $('logTime_' + issueID).show();
          $('reset_' + issueID).show();
        }
        else
        {
          $('start_' + issueID).hide();
          $('loggingBreakButton').hide();
          $('logTime_' + issueID).hide();
          $('reset_' + issueID).hide();
        }

        runningIssueID = issueID;
      }
      else
      {
        if(true == editable)
        {
          if(startTime[0] != 0 || startTime[1] != 0 || startTime[2] != 0)
          {
            $('logTime_' + issueID).show();
            $('reset_' + issueID).show();
          }
        }
        else
        {
          $('start_' + issueID).hide();
          $('loggingBreakButton').hide();
          $('logTime_' + issueID).hide();
          $('reset_' + issueID).hide();
        }
      }

      if(undefined == stopWatches[issueID] || null == stopWatches[issueID])
      {
        stopWatches[issueID] = new Stopwatch(function(watch){
          var st = $('stopwatch[' + getIssueIdFromElem(issue) + ']');
          if(null != st){
            st.update(watch.toString());
          }
        }, 1, startTime, isPending);
      }
    })
  }
  if(null != runningIssueID)
  {
    stopWatches[runningIssueID].start();
  }
}

function changeUser(selectElement)
{
  if(selectElement.value != '-1')
  {
    var url = '/stuff_to_do';
    if(selectElement.value != current_user_id.toString())
    {
      url += '?user_id=' + selectElement.value;
    }
    window.location.href = url;
  }
}

function updateElements()
{
  $$('.issue').each(function(el){
    el.setStyle({
      cursor: false == editable ? 'default' : 'move'
    })
  });

  if(false == editable)
  {
    $$('.editable').each(function(el){
      el.hide();
    })
  }

  if($('logtimediv') != null)
  {
    new Draggable('logtimediv');
  }
}

function pausecomp(millis)
{
  var date = new Date();
  var curDate = null;

  do {
    curDate = new Date();
  }
  while(curDate-date < millis);
}

// Read a page's GET URL variables and return them as an associative array.
function getUrlVars()
{
  var vars = [], hash;
  var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

  for(var i = 0; i < hashes.length; i++)
  {
    hash = hashes[i].split('=');
    vars.push(hash[0]);
    vars[hash[0]] = hash[1];
  }

  return vars;
}

Event.observe(window, 'load', function(e){
  //  if(navigator.userAgent.toLowerCase().indexOf('chrome') > -1)
  //  {
  //
  //  }
  //
  //pausecomp(1000)
  //  if(!location.href.match(/end_of_work/gi))
  //  {
  //    new Ajax.Updater('content', window.location.href, {
  //      method: 'get',
  //      asynchronous: false,
  //      onComplete:function()
  //      {
  //        attachSortables();
  //        updateStopwatches();
  //        updateElements();
  //      }
  //    });
  //  }
  //
  });

function textareaLimit(event, el, limit)
{
  if(null == limit)
  {
    limit = 5;
  }

  el = $(el);

  if(el.value.length == limit)
  {
    event.stop();
  }
}

/**
   *
   *  Javascript trim, ltrim, rtrim
   *  http://www.webtoolkit.info/
   *
   **/

function trim(str, chars) {
  return ltrim(rtrim(str, chars), chars);
}

function ltrim(str, chars) {
  chars = chars || "\\s";
  return str.replace(new RegExp("^[" + chars + "]+", "g"), "");
}

function rtrim(str, chars) {
  chars = chars || "\\s";
  return str.replace(new RegExp("[" + chars + "]+$", "g"), "");
}

function imposeMaxLength(Object, MaxLen)
{
  return (Object.value.length <= MaxLen);
}

function isSpecialKey(keyCode)
{
  return keyCode == Event.KEY_BACKSPACE
  || keyCode == Event.KEY_TAB
  || keyCode == Event.KEY_RETURN
  || keyCode == Event.KEY_ESC
  || keyCode == Event.KEY_LEFT
  || keyCode == Event.KEY_UP
  || keyCode == Event.KEY_RIGHT
  || keyCode == Event.KEY_DOWN
  || keyCode == Event.KEY_DELETE
  || keyCode == Event.KEY_HOME
  || keyCode == Event.KEY_END
  || keyCode == Event.KEY_PAGEUP
  || keyCode == Event.KEY_PAGEDOWN
  || keyCode == Event.KEY_INSERT;
}
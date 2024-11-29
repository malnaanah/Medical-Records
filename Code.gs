const spreadsheetFolderName = "spreadsheets";
const imageFolderName = "images";
const rowLimit = 10001;
const headerVisits = 100; // number of visits to show in the spreadsheet header
const firstVisitIndex = 8; // index start from 0
//===================================================
function doGet(request) {
  language = configure('language','read').value;
  if (language == 'ar'){
    title ="السجلات الطبية";
  }else{
    title = "Medical Records";
  }
  template = HtmlService.createTemplateFromFile('index').evaluate().setTitle(title);
  template.addMetaTag('viewport', "width=device-width, initial-scale=1.0, user-scalable=no");
  return template;
}
//======================================================
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
//============================================================
function initiate() {
  try{
    var scriptFolder = DriveApp.getFileById(ScriptApp.getScriptId()).getParents().next();
    var folders = DriveApp.getFolderById(scriptFolder.getId()).getFoldersByName(spreadsheetFolderName);

    // Create spreadsheet folder if it does not exist
    if (!folders.hasNext()) {
      var spreadsheetFolder = scriptFolder.createFolder(spreadsheetFolderName);
    }else{
      var spreadsheetFolder =  folders.next();
    }
    var spreadsheetFolderId = spreadsheetFolder.getId();

    // Create spreadsheet if it does not exist
    var files = spreadsheetFolder.getFilesByType(MimeType.GOOGLE_SHEETS);
    var spreadsheetDict = {};

    var totalRecords=0;
    var numericFilenamePattern = /^\d+$/;
    while (files.hasNext()) {
      var file = files.next();
      var fileName = file.getName();
      var fileId = file.getId();
      if (numericFilenamePattern.test(fileName)) {
        spreadsheetDict[fileName] = fileId;
      }
      totalRecords += SpreadsheetApp.openById(fileId).getActiveSheet().getLastRow() - 1;
    }

    if (Object.keys(spreadsheetDict).length === 0) {
      spreadsheetDict["1"] = createSpreadsheet("1", spreadsheetFolderId);
    }
    // Create image folder if it does not exist
    folders = DriveApp.getFolderById(scriptFolder.getId()).getFoldersByName(imageFolderName);
    if (!folders.hasNext()) {
      var imageFolder = scriptFolder.createFolder(imageFolderName);
    }else{
      var imageFolder =  folders.next();
    }
    var imageFolderId = imageFolder.getId();



    var language = configure('language', 'read').value;
    var lastSessionTime = configure('lastSessionTime', 'read').value;
    var showDisclaimer = configure('showDisclaimer', 'read').value;
    var maxImageSize = configure('maxImageSize', 'read').value;
    var enableImageResize = configure('enableImageResize', 'read').value;


    var response = {
      status:"SUCCESS",
      language:language,
      showDisclaimer:showDisclaimer,
      maxImageSize:maxImageSize,
      enableImageResize:enableImageResize,
      spreadsheetFolderId:spreadsheetFolderId,
      imageFolderId:imageFolderId,
      spreadsheetDict:spreadsheetDict,
      totalRecords:totalRecords,
      lastSessionTime: lastSessionTime
    };
    return response;
  }catch (error){
    
    var response = {status:"FAIL",error:error.stack};
    return response;
  }
}
//======================================================
function addPatient(data){
  try {
    var activeSpreadsheetName = data.activeSpreadsheetName;
    var activeSpreadsheetId = data.activeSpreadsheetId;

    var lastRow = SpreadsheetApp.openById(activeSpreadsheetId).getActiveSheet().getLastRow();

    if (lastRow >= rowLimit){
      activeSpreadsheetName = (parseInt(activeSpreadsheetName) + 1).toString();
      activeSpreadsheetId = createSpreadsheet(activeSpreadsheetName, data.spreadsheetFolderId);
      lastRow = 1;
    }

    var activeRow = lastRow + 1;
    var sheet = SpreadsheetApp.openById(activeSpreadsheetId).getActiveSheet();
    sheet.insertRowAfter(activeRow - 1);
    sheet.getRange(activeRow, 1).setValue(0);
    response = {
      status: "SUCCESS",
      activeSpreadsheetName: activeSpreadsheetName,
      activeSpreadsheetId:activeSpreadsheetId,
      activeRow: activeRow
    }
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}

//==================================================================
function deletePatient(activeSpreadsheetId, activeRow){
  try {
    var sheet = SpreadsheetApp.openById(activeSpreadsheetId).getActiveSheet();
    // deleting image folder
    var imageSubFolderId = sheet.getRange(activeRow, 8, 1, 1).getValue().trim();
    if (imageSubFolderId != ""){
      DriveApp.getFolderById(imageSubFolderId).setTrashed(true);
    }
    // deleting patient row
    sheet.deleteRow(parseInt(activeRow));
    response = {status:"SUCCESS"}
    return response;

  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}

//===============================================================
function savePatient(data){
  try {
    data.name = decodeURIComponent(data.name);
    data.phone = decodeURIComponent(data.phone);
    data.address = decodeURIComponent(data.address);
    data.birthDate = decodeURIComponent(data.birthDate);
    data.bloodType = decodeURIComponent(data.bloodType);
    data.patientNotes = decodeURIComponent(data.patientNotes);
    data.name = decodeURIComponent(data.name);

    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    activeRow = parseInt(data.activeRow);
    var range = sheet.getRange(activeRow, 2, 1, 6);
    range.setNumberFormat('@');
    range.setValues([[data.name, data.phone, data.address, data.birthDate, data.bloodType, data.patientNotes ]]);

    //update image folder name if exist
    var imageSubFolderId = sheet.getRange(data.activeRow, 8, 1, 1).getValue().trim();
    if (imageSubFolderId != ""){
      DriveApp.getFolderById(imageSubFolderId).setName(data.name);
    }
    response = {status:"SUCCESS"}
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//==============================================================
function getPatientList(spreadsheetDict,searchIndex,searchTxt,showSearchNumbers){
  try {
    var patientArray = [];
    for (var key in spreadsheetDict) {
      var sheet = SpreadsheetApp.openById(spreadsheetDict[key]).getActiveSheet();
      var lastRow = sheet.getLastRow();
      if(lastRow == 1) continue;
      var textFinder = sheet.getRange(2,parseInt(searchIndex)+2,lastRow-1,1)
        .createTextFinder(searchTxt).matchEntireCell(false).matchCase(false).useRegularExpression(true);

      var foundRanges = textFinder.findAll();
      for (i = 0;i<foundRanges.length;i++){
        var row = foundRanges[i].getRow();
        var name = sheet.getRange(row, 2).getValue();
        if (showSearchNumbers){
          var visits = sheet.getRange(row, 1).getValue();

          var imageSubFolderId = sheet.getRange(row, 8).getValue().trim();
          images = 0;
          if (imageSubFolderId != ""){
            try{
              var files = DriveApp.getFolderById(imageSubFolderId).getFiles();
              // Iterate through files and count them
              while(files.hasNext()){
                images++;
                files.next();
              }
            }catch(error){
              images = 0;
            }
          }
          patientArray.push([name, key, row, visits, images]);
        }else{
          patientArray.push([name, key, row]);
        }
      }
    }
    // // sorting array using first column
    // patientArray.sort(function(a, b) { return a[0].localeCompare(b[0]); });

    var response = {
      status:"SUCCESS",
      patientArray:patientArray
    };
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//==============================================================
function getPatient(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var rowData = sheet.getRange(data.activeRow, 2, 1, 6).getValues();
    var response = {
      status:"SUCCESS",
      name:rowData[0][0],
      phone:rowData[0][1],
      address:rowData[0][2],
      birthDate:rowData[0][3],
      bloodType:rowData[0][4],
      patientNotes:rowData[0][5]
    };
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//===============================================================
function getVisit(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    // var totalVisits = parseInt(sheet.getRange(data.activeRow, 1, 1, 1).getValues()[0][0]);
    var activeVisit = parseInt(data.activeVisit);

    var visit = sheet.getRange(data.activeRow, firstVisitIndex + (activeVisit -1)*2 + 1, 1, 2).getValues()[0];
    var response = {
      status:"SUCCESS",
        visitTime : new Date(visit[0]).toLocaleString('en-GB'),
      visitNotes : visit[1]
    }

    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function addVisit(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var totalVisits = parseInt(sheet.getRange(data.activeRow, 1, 1, 1).getValues()[0][0]);
    var activeVisit = totalVisits + 1;

    sheet.getRange(data.activeRow, 1).setValue(activeVisit);
    sheet.getRange(data.activeRow, firstVisitIndex + (activeVisit -1)*2 + 1).setValue(data.visitTime);

    var response = {
      status:"SUCCESS",
      activeVisit : activeVisit,
      visitTime : data.visitTime.toLocaleString('en-GB'),
      visitNotes: ""
    };
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function getVisitList(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var totalVisits = parseInt(sheet.getRange(data.activeRow, 1, 1, 1).getValues()[0][0]);
    var visitArray = [];

    if(totalVisits <= 0){
      var response = {
        status:"SUCCESS",
        visitArray:visitArray
      }
      return response;
    }

    var visits = sheet.getRange(data.activeRow, firstVisitIndex + 1, 1, 2*totalVisits).getValues()[0];
    for (var i = 0; i < totalVisits*2; i+=2) {
      visitDate = new Date(visits[i]).toLocaleString('en-GB');
      visitNote = visits[i+1];
      visitArray.push([visitDate, visitNote]);
    }

    var response = {
      status:"SUCCESS",
      visitArray:visitArray
    }
    return response;

  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function saveVisit(data){
  try {
    data.visitNotes = decodeURIComponent(data.visitNotes);
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var activeRow = parseInt(data.activeRow);
    var activeVisit = parseInt(data.activeVisit);
    var range = sheet.getRange(activeRow, firstVisitIndex + (activeVisit -1) * 2 + 2, 1, 1);
    range.setNumberFormat('@');
    range.setValues([[data.visitNotes]]);
    response = {status:"SUCCESS"}
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function deleteVisit(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var activeRow = parseInt(data.activeRow);
    var activeVisit = parseInt(data.activeVisit);
    var range = sheet.getRange(activeRow, firstVisitIndex + (activeVisit -1) * 2 + 1, 1, 2);
    range.deleteCells(SpreadsheetApp.Dimension.COLUMNS);
    var totalVisits = parseInt(sheet.getRange(data.activeRow, 1, 1, 1).getValues()[0][0]);

    if( totalVisits > 1){
      if (activeVisit>1){
        activeVisit = activeVisit -1;
      }
    } else{
      activeVisit = 0;
    }

    totalVisits = totalVisits -1;
    sheet.getRange(data.activeRow, 1, 1, 1).setValue(totalVisits);

    var response = {
      status:"SUCCESS",
      activeVisit:activeVisit
    };
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//===============================================================
function createSpreadsheet (newSpreadsheetName,spreadsheetFolderId){
    var newSpreadsheet = SpreadsheetApp.create(newSpreadsheetName);
    var newSpreadsheetId = newSpreadsheet.getId();
    DriveApp.getFileById(newSpreadsheetId).moveTo( DriveApp.getFolderById(spreadsheetFolderId));
    var rowData = ["No. of visits","Name", "Phone", "Address", "Birth date", "Blood Type", "Notes", "Image Folder ID"];
    for (var visit = 1; visit <= headerVisits; visit++) {
      rowData.push("Visit Time " + visit);
      rowData.push("Visit Note " + visit);
    }
    var sheet = newSpreadsheet.getActiveSheet();
    var range = sheet.getRange(1, 1, 1, rowData.length);
    range.setValues([rowData]);
    sheet.setFrozenRows(1);
    return newSpreadsheetId;
}
//=================================================================
function importFile(file ,activeSpreadsheetId) {
  try {
    var activeSheet = SpreadsheetApp.openById(activeSpreadsheetId).getActiveSheet();
    var blob = Utilities.newBlob(file.bytes, file.mimeType, file.filename);
    var file = DriveApp.createFile(blob);

    var blob = file.getBlob();
    var resource = {
      title: file.getName(),
      mimeType: 'application/vnd.google-apps.spreadsheet'
    };

    var data = SpreadsheetApp.openById(Drive.Files.insert(resource, blob).id).getSheets()[0].getDataRange().getValues();
    var visitSheet = SpreadsheetApp.openById(Drive.Files.insert(resource, blob).id).getSheets()[1];
    var visitRange = visitSheet.getRange(1,1,visitSheet.getLastRow(),1);
    var visitValues = visitSheet.getRange(1,2,visitSheet.getLastRow(),2).getValues();
    var activeRow = activeSheet.getLastRow();
    var firstRow = activeRow;

    for (var row = 1; row < data.length; row++) {
      activeRow = activeRow + 1;
      var rowData = [data[row][1],arabicNumber(data[row][10]),data[row][5],data[row][2],data[row][7]];
      activeSheet.getRange(activeRow, 2, 1, 5).setNumberFormat('@').setValues([rowData]);

      var visitList = visitRange.createTextFinder(data[row][0]).matchEntireCell(true).findAll().map((r) => r.getRow());
      activeSheet.getRange(activeRow,1,1,1).setValue(visitList.length);
      for (var i = 0; i< visitList.length; i++){
        activeSheet.getRange(activeRow,firstVisitIndex+(i+1)*2,1,1)
        .setValue(visitValues[visitList[i]-1][0]+"\n\n"+visitValues[visitList[i]-1][1]);
      }
    }
    var response = {
      status:"SUCCESS",
      importedRows:(activeRow-firstRow)
    }
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function uploadImage(data) {
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var imageSubFolderId = sheet.getRange(data.activeRow, 8, 1, 1).getValue().trim();

 
    // check if no image folder assigned
    if (imageSubFolderId == ""){
      const imageSubFolderName = sheet.getRange(data.activeRow, 2, 1, 1).getValue();
      imageSubFolderId = DriveApp.getFolderById(data.imageFolderId).createFolder(imageSubFolderName).getId();
      sheet.getRange(data.activeRow, 8, 1, 1).setValue(imageSubFolderId);
    }
    // check if image folder is inside main image directory
    try {
      var parentFolderId = DriveApp.getFolderById(imageSubFolderId).getParents().next().getId();
      if (parentFolderId !== data.imageFolderId || DriveApp.getFolderById(imageSubFolderId).isTrashed()){
        const imageSubFolderName = sheet.getRange(data.activeRow, 2, 1, 1).getValue();
        imageSubFolderId = DriveApp.getFolderById(data.imageFolderId).createFolder(imageSubFolderName).getId();
        sheet.getRange(data.activeRow, 8, 1, 1).setValue(imageSubFolderId);         
      }
    } catch (error) {
      const imageSubFolderName = sheet.getRange(data.activeRow, 2, 1, 1).getValue();
      imageSubFolderId = DriveApp.getFolderById(data.imageFolderId).createFolder(imageSubFolderName).getId();
      sheet.getRange(data.activeRow, 8, 1, 1).setValue(imageSubFolderId);
    }


    var blob = Utilities.newBlob(data.file.bytes, data.file.mimeType, data.file.filename);
    var file = DriveApp.createFile(blob);

    // var imageSubFolderId = sheet.getRange(data.activeRow, 8, 1, 1).getValue();

    // Create the file with the new name
    var folder = DriveApp.getFolderById(imageSubFolderId);
    // file.setName(newFileName);
    file.moveTo(folder)

    var response = { status: "SUCCESS" };
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function arabicNumber(number){
  const numDict = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };
 return number.replace(/[٠-٩]/g, function (num) {
    return numDict[num];
  });
}
//=================================================================
function updateVisitTime(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var activeRow = parseInt(data.activeRow);
    var activeVisit = parseInt(data.activeVisit);

    sheet.getRange(data.activeRow, firstVisitIndex + (activeVisit -1)*2 + 1).setValue(data.dateTime);
    response = {status:"SUCCESS"}
    return response
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function getImageList(data){
  try {
    var sheet = SpreadsheetApp.openById(data.activeSpreadsheetId).getActiveSheet();
    var imageSubFolderId = sheet.getRange(data.activeRow, 8, 1, 1).getValue().trim();


    var fileArray = [];
    
    // check if no image folder assigned
    if (imageSubFolderId == ""){
      var response = {
        status:"SUCCESS",
          imageArray:fileArray
        }
      return response;
    }
    // check if image folder is inside main image directory
    try {
      var parentFolderId = DriveApp.getFolderById(imageSubFolderId).getParents().next().getId();
      if (parentFolderId !== data.imageFolderId || DriveApp.getFolderById(imageSubFolderId).isTrashed()){
      var response = {
        status:"SUCCESS",
          imageArray:fileArray
        }
      return response;       
      }
    } catch (error) {
      const imageSubFolderName = sheet.getRange(data.activeRow, 2, 1, 1).getValue();
      imageSubFolderId = DriveApp.getFolderById(data.imageFolderId).createFolder(imageSubFolderName).getId();
      sheet.getRange(data.activeRow, 8, 1, 1).setValue(imageSubFolderId);
    }



    var files = DriveApp.getFolderById(imageSubFolderId).getFiles();

    while (files.hasNext()) {
      var file = files.next();
      fileArray.push([file.getName(), file.getId(), formatBytes(file.getSize())]);
    }

    // Sort the fileArray by the first column (file names)
    fileArray.sort(function(a, b) { return a[0].localeCompare(b[0]); });

    var response = {
      status:"SUCCESS",
      imageArray:fileArray
    }
    return response;
  }catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }

}
//=================================================================
function formatBytes(bytes) {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes == 0) return '0 Byte';
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(100 * (bytes / Math.pow(1024, i))) / 100 + ' ' + sizes[i];
}
//=================================================================
function getImage(data){

  try {
    const imageFileName = DriveApp.getFileById(data.activeImageId).getName();
    var imageBlob = DriveApp.getFileById(data.activeImageId).getBlob();
    var imageUrl = "data:" + imageBlob.getContentType() + ";base64," + Utilities.base64Encode(imageBlob.getBytes());
    var response = {
      status:"SUCCESS",
      imageFileName:imageFileName,
      imageUrl:imageUrl
    }
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function deleteImage(data){
  try {
    DriveApp.getFileById(data.activeImageId).setTrashed(true);
    var response = {status:"SUCCESS"}
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//==============================================================
function getVisitDates(spreadsheetDict){
  try {
    var visitDatesArray = [];
    var firstVisitDatesArray = [];
    for (var key in spreadsheetDict) {
      var sheet = SpreadsheetApp.openById(spreadsheetDict[key]).getActiveSheet();
      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;
      for (var row = 1; row<=lastRow; row++){
        var totalVisits = parseInt(sheet.getRange(row, 1, 1, 1).getValues()[0][0]);
        if (isNaN(totalVisits) || totalVisits < 1) continue;
        var visits = sheet.getRange(row, firstVisitIndex + 1, 1, 2*totalVisits).getValues()[0];
        for (var visit = 0; visit < totalVisits; visit++) {
          visitDate = new Date(visits[visit*2]).toLocaleString('en-GB');
          visitDatesArray.push([visitDate]);
          if (visit == 0){
            firstVisitDatesArray.push([visitDate]);
          }
        }
      }
    }
    var response = {
      status:"SUCCESS",
      visitDatesArray:visitDatesArray,
      firstVisitDatesArray:firstVisitDatesArray
    }
    return response;
  } catch (error) {
      
      var response = {status:"FAIL",error:error.stack};
      return response;
  }
}
//=================================================================
function configure(key,action,value){
  try {
    var response = {status:"SUCCESS"}
    var defaultConfig = {
      'language':'ar',
      'showDisclaimer':"on",
      'maxImageSize': 4,
      'enableImageResize':true,
      'lastSessionTime':'0'
    }
    var currentfolder = DriveApp.getFileById(ScriptApp.getScriptId()).getParents().next();
    var files = currentfolder.getFilesByName("config.json");
      if (files.hasNext()) {
        var configFile = files.next();
      } else {
        // create default configuration
        var configuration = {};
        var configFile = currentfolder.createFile("config.json", JSON.stringify(configuration));
      }

    var configuration = JSON.parse(configFile.getBlob().getDataAsString());
    if (action == 'read'){
      if (!(key in configuration)) {
        configuration[key] = defaultConfig[key];
        configFile.setContent(JSON.stringify(configuration));
      }
      response['value'] = configuration[key];
    } else if(action == 'write'){
      configuration[key] = value;
      configFile.setContent(JSON.stringify(configuration));
    }
    return response;
  } catch (error) {
    
    var response = {status:"FAIL",error:error.stack};
    return response;
  }
}

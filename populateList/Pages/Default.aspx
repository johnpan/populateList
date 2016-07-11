<%-- The following 4 lines are ASP.NET directives needed when using SharePoint components --%>
<%@ Page Inherits="Microsoft.SharePoint.WebPartPages.WebPartPage, Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" MasterPageFile="~masterurl/default.master" Language="C#" %>
<%@ Register TagPrefix="Utilities" Namespace="Microsoft.SharePoint.Utilities" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="WebPartPages" Namespace="Microsoft.SharePoint.WebPartPages" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%@ Register TagPrefix="SharePoint" Namespace="Microsoft.SharePoint.WebControls" Assembly="Microsoft.SharePoint, Version=15.0.0.0, Culture=neutral, PublicKeyToken=71e9bce111e9429c" %>
<%-- The markup and script in the following Content element will be placed in the <head> of the page --%>
<asp:Content ContentPlaceHolderID="PlaceHolderAdditionalPageHead" runat="server">
    <script src="https://code.jquery.com/jquery-2.1.1.min.js"></script> 
    <script type="text/javascript" src="/_layouts/15/sp.runtime.js"></script>
    <script type="text/javascript" src="/_layouts/15/sp.js"></script>
    <!-- RequestExecutor.js was put to have REST in spyreqs-->
    <script type="text/javascript" src="/_layouts/15/SP.RequestExecutor.js"></script>    
    <!-- core.js was put to have UI.Notify -->
    <script type="text/javascript" src="/_layouts/15/core.js"></script>
    <meta name="WebPartPageExpansion" content="full" />
    <!-- Add your CSS styles to the following file -->
    <link rel="Stylesheet" type="text/css" href="../Content/App.css" />    
    <link rel="Stylesheet" type="text/css" href="../Content/modal.css" />    
</asp:Content>
<%-- The markup in the following Content element will be placed in the TitleArea of the page --%>
<asp:Content ContentPlaceHolderID="PlaceHolderPageTitleInTitleArea" runat="server">
    Populate a List
</asp:Content>

<%-- The markup and script in the following Content element will be placed in the <body> of the page --%>
<asp:Content ContentPlaceHolderID="PlaceHolderMain" runat="server">

<div id="allContent" ng-app="ngApp" ng-controller="appCtrl" ng-cloak>    
        
     <!-- modal div -->
    <div id="modal">
        <div class="shade"></div>
		<div class="outer">
			<div class="inner">
				<div class="header">
					<h2>Logs window</h2>					
					<button type="button" id="closeModalBtn">Close</button>
                    <button type="button" id="clearModalBtn">Clear</button>
				</div>
				<div class="content" id="logger">
					<p>ready</p>
				</div>

			</div>
		</div>
    </div>
    <!-- modal div ends -->

        <div id="showTheLists" class="nobr">
            Please pick a list from Host site
	        <select ng-model="ngSelected" ng-change="getSelectedList(ngSelected)"> 
		        <option value="">Select a list from host site</option>
		        <option ng-repeat="item in data_Lists" value="{{item.Title}}" >{{item.Title}}</option>         
	        </select>
            <button type="button" ng-click="updateTable('data_ListFieldsArr')" id="getFieldsBtn">Get List Fields</button>
            <button type="button" ng-click="autoSelect('data_ListFieldsArr')" id="autoSelectBtn">Auto select</button>   
            <span style="float: right;"><a href="#" id="visitListHref"></a></span>
        </div>  
 
        <div id="showTheFileds">    
                
        <table class="myDataTable" >
          <tr class="tableHeader">
            <th>Select</th>
            <th>Title</th>
            <th>Type</th>              
            <th>Required</th>
            <th>InternalName</th>
            <th class="burnColumn">Data</th>
          </tr>
          <tr ng-repeat="row in data_ListFieldsArr" 
              ng-model="row.ngConfigured"
              ng-class="{
		        selectedRow: row.ngSelected === true,
		        unselectedRow: row.ngSelected === false}">
            <td class='checkBoxColumn'><input ng-model="row.ngSelected" type="checkbox"></td>
            <td>{{row.Title}}</td>                    		
            <td>{{row.TypeDisplayName}}</td>              
            <td>{{row.Required}}</td>
            <td>{{row.InternalName}}</td> 
            <td class="configSection">   

                <select ng-model="row.selectAutoFillData" 
                        ng-change="getSelectedDataEntryMethod(row)" 
                        ng-options="item as item.title for item in autoFillOptions">
                </select>  
               
                <span ng-model="row.label" ng-class="'configLabel'+row.Id">{{row.label}}</span>
                <input ng-model="row.dataEntryText" ng-class="'configText'+row.Id"/>
                <div id="'configDiv'+row.Id">

                </div>
            </td>            
          </tr>
          <tr>	
            <th>
                <input class='checkBoxColumn' ng-model="ngAllSelected" ng-click="checkAll('data_ListFieldsArr')" type="checkbox">
            </th>
            <th colspan='4'>Actions: 
                <button type='button' ng-click="deleteSelected('data_ListFieldsArr')">Delete</button>    
                <button type='button' id="showModalBtn">Show logs</button>                
	        </th>	
            <th id="burnSection"> 
                Records to create: <input ng-model="burnAmmount"/>
                <button type='button' id="testBurnBtn" ng-click="testBurn('data_ListFieldsArr')">Test one record!</button>
                <button type='button' id="burnBtn" ng-click="burn('data_ListFieldsArr')">Burn!</button> 
                <span id="burnProgressLabel" ng-model="burnProgress">{{burnProgress}}</span>             
            </th>
          </tr>
        </table>
        </div>        

    <!-- ngApp div ends -->
    
</div>       
    <script type="text/javascript"src="https://ajax.googleapis.com/ajax/libs/angularjs/1.3.0/angular.min.js"></script>
    <script type="text/javascript" src="../Scripts/spyreqs.min.js"></script>
    <script type="text/javascript" src="../Scripts/spyreqs_populateList.js"></script>
    <script type="text/javascript" src="../Scripts/App.js"></script>
</asp:Content>

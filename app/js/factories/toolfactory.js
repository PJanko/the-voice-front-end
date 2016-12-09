
///////////////////////////////////////////////////////////////////////////////
// Tool Factory
///////////////////////////////////////////////////////////////////////////////
angular.module("TheVoice").factory("ToolFactory", function(){
	
	var _factory = {

		getYoutubeThumbnail : function(id){
			return 'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg';
		},

		getYoutubeURL : function(id) {
			return 'https://www.youtube.com/watch?v='+id;
		},

		getYoutubeID : function(url) {
			return url;
		}

	}		   
	

	return _factory;

});
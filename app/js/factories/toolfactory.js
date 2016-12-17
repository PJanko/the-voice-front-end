
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
			var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
		    var match = url.match(regExp);
		    return (match&&match[7].length==11)? match[7] : false;
		}

	}


	return _factory;

});

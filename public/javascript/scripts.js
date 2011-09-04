function validateEmail($email) {
	var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
	if( !emailReg.test( $email ) ) {
		return false;
	} else {
		return true;
	}
}

$(function() {
	// TODO: append datetime picker to all datetime picker classes
	$(".datetimepick").datetimepicker();
	
	// hide messages click handler
	$("a.close").click(function () {
		$(this).parent().fadeOut("slow");
	});

/*
	//TODO: add email validation for forms
	$("form").validate({
 		submitHandler: function(form) {
 			//validateEmail();
 		
   			form.submit();
 		}
 	});*/
 	
 	//TODO: add are you sure popup to delete links via jquery classes
});

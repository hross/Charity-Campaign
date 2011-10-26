function validateEmail($email) {
	var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
	if( !emailReg.test( $email ) ) {
		return false;
	} else {
		return true;
	}
}

function confirm(message, callback) {
	$('#confirm').modal({
		closeHTML: "<a href='#' title='Close' class='modal-close'>x</a>",
		position: ["20%",],
		overlayId: 'confirm-overlay',
		containerId: 'confirm-container', 
		onShow: function (dialog) {
			var modal = this;

			$('.message', dialog.data[0]).append(message);

			// if the user clicks "yes"
			$('.yes', dialog.data[0]).click(function (e) {
        e.preventDefault();

				// call the callback
				if ($.isFunction(callback)) {
					callback.apply();
				}
				// close the dialog
				modal.close(); // or $.modal.close();
			});
		}
	});
}

$(function() {
	$(".datetimepick").datetimepicker();
	
	// hide messages click handler
	$("a.close").click(function () {
		$(this).parent().fadeOut("slow");
	});

	// show modal dialog for delete buttons
	$('.delete').click(function (e) {
		e.preventDefault();
		
		var continueLink = $(this).attr('href');

		// call back only fires on 'yes'
		confirm("Are you sure?", function () {
			window.location.href = continueLink;
		});

    return false;
	});
});

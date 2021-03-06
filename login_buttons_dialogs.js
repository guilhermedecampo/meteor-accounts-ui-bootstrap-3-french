(function() {
	// for convenience
	var loginButtonsSession = Accounts._loginButtonsSession;


	//
	// populate the session so that the appropriate dialogs are
	// displayed by reading variables set by accounts-urls, which parses
	// special URLs. since accounts-ui depends on accounts-urls, we are
	// guaranteed to have these set at this point.
	//

	// if (Router&& Router.current().params.token) {
	// 	loginButtonsSession.set('resetPasswordToken', Router.current().params.token);
	// }

	// if (Router&& Router.current().params.token) {
	// 	loginButtonsSession.set('enrollAccountToken', Router.current().params.token);
	// }

	// Needs to be in Meteor.startup because of a package loading order
	// issue. We can't be sure that accounts-password is loaded earlier
	// than accounts-ui so Accounts.verifyEmail might not be defined.
	Meteor.startup(function() {
		if (Accounts._verifyEmailToken) {
			Accounts.verifyEmail(Accounts._verifyEmailToken, function(error) {
				Accounts._enableAutoLogin();
				if (!error)
					loginButtonsSession.set('justVerifiedEmail', true);
				// XXX show something if there was an error.
			});
		}
	});

	//
	// resetPasswordDialog template
	//

	Template._resetPasswordDialog.events({
		'click #login-buttons-reset-password-button': function(event) {
			event.stopPropagation();
			resetPassword();
		},
		'keypress #reset-password-new-password': function(event) {
			if (event.keyCode === 13)
				resetPassword();
		},
		'click #login-buttons-cancel-reset-password': function(event) {
			event.stopPropagation();
			Accounts._enableAutoLogin();
			$('#login-buttons-reset-password-modal').modal("hide");
		}
	});

	var resetPassword = function() {
		loginButtonsSession.resetMessages();
		var newPassword = document.getElementById('reset-password-new-password').value;
		if (!Accounts._loginButtons.validatePassword(newPassword))
			return;

		Accounts.resetPassword(
			Router.current().params.token, newPassword,
			function(error) {
				if (error) {
					loginButtonsSession.errorMessage(error.reason || "Unknown error");
				} else {
					Accounts._enableAutoLogin();
					$('#login-buttons-reset-password-modal').modal("hide");
				}
			});
	};

	Template._resetPasswordDialog.helpers({
		inResetPasswordFlow: function() {
			return Router.current().params.token;
		}
	});

	Template._resetPasswordDialog.rendered = function() {
		var $modal = $(this.find('#login-buttons-reset-password-modal'));
		$modal.modal();
	};

	//
	// enrollAccountDialog template
	//

	Template._enrollAccountDialog.events({
		'click #login-buttons-enroll-account-button': function() {
			enrollAccount();
		},
		'keypress #enroll-account-password': function(event) {
			if (event.keyCode === 13)
				enrollAccount();
		},
		'click #login-buttons-cancel-enroll-account-button': function() {
			Accounts._enableAutoLogin();
			$modal.modal("hide");
		}
	});

	var enrollAccount = function() {
		loginButtonsSession.resetMessages();
		var password = document.getElementById('enroll-account-password').value;
		if (!Accounts._loginButtons.validatePassword(password))
			return;

		Accounts.resetPassword(
			Router.current().params.token, password,
			function(error) {
				if (error) {
					loginButtonsSession.errorMessage(error.reason || "Unknown error");
				} else {
					Accounts._enableAutoLogin();
					$modal.modal("hide");
				}
			});
	};

	Template._enrollAccountDialog.helpers({
		inEnrollAccountFlow: function() {
			return Router.current().params.token;
		}
	});

	Template._enrollAccountDialog.rendered = function() {
		$modal = $(this.find('#login-buttons-enroll-account-modal'));
		$modal.modal();
	};

	//
	// justVerifiedEmailDialog template
	//

	Template._justVerifiedEmailDialog.events({
		'click #just-verified-dismiss-button': function() {
			loginButtonsSession.set('justVerifiedEmail', false);
		}
	});

	Template._justVerifiedEmailDialog.helpers({
		visible: function() {
			if (loginButtonsSession.get('justVerifiedEmail')) {
				setTimeout(function() {
					$('#login-buttons-email-address-verified-modal').modal()
				}, 500)
			}
			return loginButtonsSession.get('justVerifiedEmail');
		}
	});


	//
	// loginButtonsMessagesDialog template
	//

	// Template._loginButtonsMessagesDialog.rendered = function() {
	//   var $modal = $(this.find('#configure-login-service-dialog-modal'));
	//   $modal.modal();
	// }

	Template._loginButtonsMessagesDialog.events({
		'click #messages-dialog-dismiss-button': function() {
			loginButtonsSession.resetMessages();
		}
	});

	Template._loginButtonsMessagesDialog.helpers({
		visible: function() {
			var hasMessage = loginButtonsSession.get('infoMessage') || loginButtonsSession.get('errorMessage');
			return !Accounts._loginButtons.dropdown() && hasMessage;
		}
	});


	//
	// configureLoginServiceDialog template
	//

	Template._configureLoginServiceDialog.events({
		'click .configure-login-service-dismiss-button': function(event) {
			event.stopPropagation();
			loginButtonsSession.set('configureLoginServiceDialogVisible', false);
			$('#configure-login-service-dialog-modal').modal('hide');
		},
		'click #configure-login-service-dialog-save-configuration': function() {
			if (loginButtonsSession.get('configureLoginServiceDialogVisible') &&
				!loginButtonsSession.get('configureLoginServiceDialogSaveDisabled')) {
				// Prepare the configuration document for this login service
				var serviceName = loginButtonsSession.get('configureLoginServiceDialogServiceName');
				var configuration = {
					service: serviceName
				};
				_.each(configurationFields(), function(field) {
					configuration[field.property] = document.getElementById(
						'configure-login-service-dialog-' + field.property).value
						.replace(/^\s*|\s*$/g, ""); // trim;
				});

				// Configure this login service
				Meteor.call("configureLoginService", configuration, function(error, result) {
					if (error)
						Meteor._debug("Error configuring login service " + serviceName, error);
					else
						loginButtonsSession.set('configureLoginServiceDialogVisible', false);
					$('#configure-login-service-dialog-modal').modal('hide');
				});
			}
		},
		// IE8 doesn't support the 'input' event, so we'll run this on the keyup as
		// well. (Keeping the 'input' event means that this also fires when you use
		// the mouse to change the contents of the field, eg 'Cut' menu item.)
		'input, keyup input': function(event) {
			// if the event fired on one of the configuration input fields,
			// check whether we should enable the 'save configuration' button
			if (event.target.id.indexOf('configure-login-service-dialog') === 0)
				updateSaveDisabled();
		}
	});

	// check whether the 'save configuration' button should be enabled.
	// this is a really strange way to implement this and a Forms
	// Abstraction would make all of this reactive, and simpler.
	var updateSaveDisabled = function() {
		var anyFieldEmpty = _.any(configurationFields(), function(field) {
			return document.getElementById(
				'configure-login-service-dialog-' + field.property).value === '';
		});

		loginButtonsSession.set('configureLoginServiceDialogSaveDisabled', anyFieldEmpty);
	};

	// Returns the appropriate template for this login service.  This
	// template should be defined in the service's package
	var configureLoginServiceDialogTemplateForService = function() {
		var serviceName = loginButtonsSession.get('configureLoginServiceDialogServiceName');
		return Template['configureLoginServiceDialogFor' + capitalize(serviceName)];
	};

	var configurationFields = function() {
		var template = configureLoginServiceDialogTemplateForService();
		return template.fields();
	};

	Template._configureLoginServiceDialog.helpers({
		configurationFields: function() {
			return configurationFields();
		},

		visible: function() {
			return loginButtonsSession.get('configureLoginServiceDialogVisible');
		},

		configurationSteps: function() {
			// renders the appropriate template
			return configureLoginServiceDialogTemplateForService();
		},

		saveDisabled: function() {
			return loginButtonsSession.get('configureLoginServiceDialogSaveDisabled');
		}
	});


	;



	// XXX from http://epeli.github.com/underscore.string/lib/underscore.string.js
	var capitalize = function(str) {
		str = str == null ? '' : String(str);
		return str.charAt(0).toUpperCase() + str.slice(1);
	};

})();

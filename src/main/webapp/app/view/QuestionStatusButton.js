/*
 * This file is part of ARSnova Mobile.
 * Copyright (C) 2011-2012 Christian Thomas Weber
 * Copyright (C) 2012-2015 The ARSnova Team
 *
 * ARSnova Mobile is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * ARSnova Mobile is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with ARSnova Mobile.  If not, see <http://www.gnu.org/licenses/>.
 */
Ext.define('ARSnova.view.QuestionStatusButton', {
	extend: 'Ext.Panel',

	config: {
		wording: {
			release: Messages.RELEASE_QUESTION,
			confirm: Messages.CONFIRM_CLOSE_QUESTION,
			confirmMessage: Messages.CONFIRM_CLOSE_QUESTION_MESSAGE
		}
	},

	handler: null,
	isOpen: false,

	questionObj: null,

	constructor: function (args) {
		this.callParent(arguments);

		this.questionObj = args.questionObj;

		if (this.questionObj && this.questionObj.active) {
			this.isOpen = true;
		} else {
			this.isOpen = false;
		}

		this.button = Ext.create('ARSnova.view.MatrixButton', {
			buttonConfig: 'togglefield',
			text: this.getWording().release,
			scope: this,
			cls: this.getCls(),
			toggleConfig: {
				scope: this,
				label: false,
				value: this.isOpen ? 1 : 0,
				listeners: {
					scope: this,
					change: function (toggle, newValue, oldValue, eOpts) {
						if (newValue && !this.isOpen || !newValue && this.isOpen) {
							this.changeStatus();
						}
					}
				}
			}
		});

		this.add([this.button]);
	},

	changeStatus: function () {
		var me = this;
		var id = this.questionObj._id;

		if (this.isOpen) {
			Ext.Msg.confirm(this.getWording().confirm, this.getWording().confirmMessage, function (buttonId) {
				if (buttonId !== "no") {
					/* close this question */
					ARSnova.app.getController('Questions').setActive({
						questionId: id,
						active: 0,
						callback: this.questionClosedSuccessfully
					});
				} else {
					me.button.setToggleFieldValue(true);
				}
			}, this);
		} else {
			/* open this question */
			ARSnova.app.getController('Questions').setActive({
				questionId: id,
				active: 1,
				callback: this.questionOpenedSuccessfully
			});
		}
	},

	checkInitialStatus: function () {
		if (this.isRendered) {
			return;
		}

		if (localStorage.getItem('active') === "1") {
			this.isOpen = true;
			this.button.setToggleFieldValue(true);
		} else {
			this.isOpen = false;
			this.button.setToggleFieldValue(false);
		}
		this.isRendered = true;
	},

	questionClosedSuccessfully: function () {
		this.isOpen = false;
	},

	questionOpenedSuccessfully: function () {
		this.isOpen = true;
	}
});

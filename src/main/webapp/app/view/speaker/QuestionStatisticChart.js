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
Ext.define('ARSnova.view.speaker.QuestionStatisticChart', {
	extend: 'Ext.Panel',

	config: {
		title: Messages.STATISTIC,
		layout: 'fit'
	},

	gradients: null,
	questionObj: null,
	questionChart: null,
	questionStore: null,
	lastPanel: null,
	gridStatistic: null,

	/* toolbar items */
	toolbar: null,
	toggleCorrect: false,
	chartRefreshDuration: 1000,

	renewChartDataTask: {
		name: 'renew the chart data at question statistics charts',
		run: function () {
			ARSnova.app.mainTabPanel._activeItem.getQuestionAnswers();
		},
		interval: 10000 // 10 seconds
	},

	/**
	 * count every 15 seconds all actually logged-in users for this sessions
	 */
	countActiveUsersTask: {
		name: 'count the actually logged in users',
		run: function () {
			ARSnova.app.mainTabPanel._activeItem.countActiveUsers();
		},
		interval: 15000
	},

	constructor: function (args) {
		this.callParent(arguments);

		this.questionObj = args.question;
		this.lastPanel = args.lastPanel;

		this.questionStore = Ext.create('Ext.data.Store', {
			fields: [
				{name: 'text', type: 'string'},
				{name: 'value',  type: 'int'},
				{name: 'percent',  type: 'int'}
			]
		});

		var hasCorrectAnswers = Ext.bind(function () {
			var hasCorrect = false;
			this.questionObj.possibleAnswers.forEach(function (answer) {
				hasCorrect = hasCorrect || !!answer.correct;
			});
			return hasCorrect;
		}, this);

		for (var i = 0; i < this.questionObj.possibleAnswers.length; i++) {
			var pA = this.questionObj.possibleAnswers[i];
			if (pA.data) {
				this.questionStore.add({
					text: pA.data.text,
					value: 0
				});
			} else {
				this.questionStore.add({
					text: pA.text,
					value: 0
				});
			}
		}

		this.backButton = Ext.create('Ext.Button', {
			text: Messages.BACK,
			ui: 'back',
			scope: this,
			style: 'min-width: 60px;',
			handler: function () {
				ARSnova.app.innerScrollPanel = false;
				ARSnova.app.taskManager.stop(this.renewChartDataTask);
				ARSnova.app.taskManager.stop(this.countActiveUsersTask);
				ARSnova.app.mainTabPanel.animateActiveItem(ARSnova.app.mainTabPanel.tabPanel, {
					type: 'slide',
					direction: 'right',
					duration: 700
				});
			}
		});

		this.toolbar = Ext.create('Ext.Toolbar', {
			docked: 'top',
			ui: 'light',
			cls: 'answerStatisticToolbar',
			items: [this.backButton, {
				xtype: 'spacer'
			}, {
				flex: 99,
				xtype: 'title',
				title: this.questionObj.subject
			}, {
				xtype: 'spacer'
			}, {
				xtype: 'container',
				cls: "x-toolbar-title counterText",
				hidden: ARSnova.app.userRole === ARSnova.app.USER_ROLE_STUDENT,
				html: "0/0",
				style: {paddingRight: '20px'}
			}, {
				xtype: 'button',
				width: '55px',
				iconCls: 'icon-check',
				cls: 'toggleCorrectButton',
				handler: function (button) {
					var me = this,
					data = [];

					button.disable();

					if (this.toggleCorrect) {
						button.removeCls('x-button-pressed');
					} else {
						button.addCls('x-button-pressed');
					}
					this.toggleCorrect = !this.toggleCorrect;

					// remove all data for a smooth "redraw"
					this.questionStore.each(function (record) {
						data.push({
							text: record.get('text'),
							value: record.get('value'),
							percent: record.get('percent')
						});

						record.set('value', 0);
						record.set('percent', 0);
					});

					var updateDataTask = Ext.create('Ext.util.DelayedTask', function () {
						me.questionStore.setData(data);
						button.enable();
					});

					var setGradientTask = Ext.create('Ext.util.DelayedTask', function () {
						// updates the chart's colors
						me.setGradients();

						// delay till chart is redrawn
						updateDataTask.delay(me.chartRefreshDuration - 200);
					});

					// delay till chart is empty
					setGradientTask.delay(me.chartRefreshDuration - 200);
				},
				scope: this,
				hidden: !hasCorrectAnswers() || this.questionObj.questionType === 'grid' ||
						(ARSnova.app.userRole === ARSnova.app.USER_ROLE_STUDENT && !this.questionObj.showAnswer)
			}]
		});

		this.titlebar = Ext.create('ARSnova.view.MathJaxMarkDownPanel', {
			cls: 'questionStatisticTitle',
			docked: 'top',
			baseCls: Ext.baseCSSPrefix + 'title',
			style: ''
		});
		this.titlebar.setContent(this.questionObj.text, true, true);

		if (this.questionObj.questionType === "grid") {
			this.titlebar = Ext.create('Ext.Toolbar', {
				cls: 'questionStatisticTitle',
				docked: 'top',
				title: '',
				border: '0px',
				hidden: 1
			});

			this.setLayout('');
			this.setScrollable(true);

			// Setup question title and text to disply in the same field; markdown handles HTML encoding
			var questionString = '' + '\n' + this.questionObj.text;

			// Create standard panel with framework support
			this.contentField = Ext.create('ARSnova.view.MathJaxMarkDownPanel', {
				cls: "roundedBox"
			});
			this.contentField.setContent(questionString, true, true);
		}

		this.setGradients();

		this.questionChart = Ext.create('Ext.chart.CartesianChart', {
			store: this.questionStore,
			hidden: this.questionObj.questionType === "grid",

			animate: {
				easing: 'bounceOut',
				duration: this.chartRefreshDuration
			},

			axes: [{
				type: 'numeric',
				position: 'left',
				fields: ['value'],
				increment: 1,
				minimum: 0,
				majorTickSteps: 10,
				style: {
					stroke: '#4a5c66',
					lineWidth: 2
				},
				label: {
					color: '#4a5c66',
					fontWeight: 'bold'
				}
			}, {
				type: 'category',
				position: 'bottom',
				fields: ['text'],
				style: {
					stroke: '#4a5c66',
					lineWidth: 2
				},
				label: {
					color: '#4a5c66',
					fontWeight: 'bold',
					rotate: {degrees: 315}
				},
				renderer: function (label, layout, lastLabel) {
					var panel, labelColor;

					panel = ARSnova.app.userRole === ARSnova.app.USER_ROLE_STUDENT ?
							ARSnova.app.mainTabPanel.tabPanel.userQuestionsPanel.questionStatisticChart :
							ARSnova.app.mainTabPanel.tabPanel.speakerTabPanel.questionStatisticChart;

					if (panel.toggleCorrect && label !== Messages.ABSTENTION
						&& Object.keys(panel.correctAnswers).length > 0) {
						labelColor = panel.correctAnswers[label] ?  '#80ba24' : '#971b2f';
					} else {
						labelColor = '#4a5c66';
					}

					layout.segmenter.getAxis().setLabel({
						color: labelColor,
						fontWeight: 'bold',
						rotate: {degrees: 315}
					});

					return label.length < 30 ? label :
						label.substring(0, 29) + "...";
				}
			}],

			series: [{
				type: 'bar',
				xField: 'text',
				yField: 'value',
				style: {
					minGapWidth: 10,
					maxBarWidth: 200
				},
				label: {
					display: 'insideEnd',
					field: 'percent',
					color: '#fff',
					calloutColor: 'transparent',
					renderer: function (text, sprite, config, rendererData, index) {
						var barWidth = this.itemCfg.width;
						return {
							text: text + " %",
							color: config.callout ? '#4a5c66' : '#fff',
							calloutVertical: barWidth > 40 ? false : true,
							rotationRads: barWidth > 40 ? 0 : config.rotationRads,
							calloutPlaceY: barWidth <= 40 ? config.calloutPlaceY :
								config.calloutPlaceY + 10
						};
					}
				},
				renderer: function (sprite, config, rendererData, i) {
					var panel, gradient,
						data = rendererData.store.getData().getAt(i).getData();

					panel = ARSnova.app.userRole === ARSnova.app.USER_ROLE_STUDENT ?
							ARSnova.app.mainTabPanel.tabPanel.userQuestionsPanel.questionStatisticChart :
							ARSnova.app.mainTabPanel.tabPanel.speakerTabPanel.questionStatisticChart;

					gradient = data.text === Messages.ABSTENTION ?
							gradient = panel.abstentionGradient :
							gradient = panel.gradients[i % panel.gradients.length];

					return {fill: gradient};
				}
			}]
		});

		if (this.questionObj.questionType !== "grid") {
			this.add([this.toolbar, this.titlebar, this.questionChart]);
		} else {
			this.setStyle('background-color: #E0E0E0');
			// add statistic
			this.gridStatistic = Ext.create('ARSnova.view.components.GridStatistic', {
				questionObj: this.questionObj
			});

			this.add([this.toolbar, {
				xtype: 'formpanel',
				style: 'margin-top: 10px',
				scrollable: null,
				items: [this.titlebar,
						this.contentField,
						this.questionChart,
						this.gridStatistic
				]}
			]);

			this.getQuestionAnswers();
		}

		this.on('activate', this.onActivate);

		this.on('hide', function () {
			ARSnova.app.activePreviewPanel = false;
		});

		this.on('painted', function () {
			ARSnova.app.activePreviewPanel = this;
		});
	},

	onActivate: function () {
		ARSnova.app.innerScrollPanel = this;
		ARSnova.app.taskManager.start(this.renewChartDataTask);

		if (ARSnova.app.userRole === ARSnova.app.USER_ROLE_SPEAKER) {
			ARSnova.app.taskManager.start(this.countActiveUsersTask);
		}
	},

	getQuestionAnswers: function () {
		ARSnova.app.questionModel.countAnswers(sessionStorage.getItem('keyword'), this.questionObj._id, {
			success: function (response) {
				var panel = ARSnova.app.mainTabPanel._activeItem;
				var chart = panel.questionChart;
				var store = chart.getStore();

				var answers = Ext.decode(response.responseText);

				var sum = 0;
				var maxValue = 10;

				var i, el, record;
				var tmpPossibleAnswers = [];
				for (i = 0; i < tmpPossibleAnswers.length; i++) {
					el = tmpPossibleAnswers[i];
					record = store.findRecord('text', el, 0, false, true, true);
					record.set('value', 0);
				}

				for (i = 0; i < panel.questionObj.possibleAnswers.length; i++) {
					el = panel.questionObj.possibleAnswers[i];
					if (el.data) {
						tmpPossibleAnswers.push(el.data.text);
					} else {
						tmpPossibleAnswers.push(el.text);
					}
				}

				var mcAnswerCount = [];
				var abstentionCount = 0;
				var mcTotalAnswerCount = 0;
				for (i = 0; i < answers.length; i++) {
					el = answers[i];

					mcTotalAnswerCount += el.answerCount;

					if (panel.questionObj.questionType === "mc") {
						if (!el.answerText) {
							abstentionCount = el.abstentionCount;
							continue;
						}
						var values = el.answerText.split(",").map(function (answered) {
							return parseInt(answered, 10);
						});
						if (values.length !== panel.questionObj.possibleAnswers.length) {
							return;
						}

						for (var j = 0; j < el.answerCount; j++) {
							values.forEach(function (selected, index) {
								if (typeof mcAnswerCount[index] === "undefined") {
									mcAnswerCount[index] = 0;
								}
								if (selected === 1) {
									mcAnswerCount[index] += 1;
								}
							});
						}
						store.each(function (record, index) {
							record.set("value", mcAnswerCount[index]);
						});
					} else if (panel.questionObj.questionType === "grid") {
						panel.gridStatistic.answers = answers;
						panel.gridStatistic.setQuestionObj = panel.questionObj;
						panel.gridStatistic.updateGrid();
					} else {
						if (!el.answerText) {
							abstentionCount = el.abstentionCount;
							continue;
						}
						record = store.findRecord('text', el.answerText, 0, false, true, true); // exact match
						record.set('value', el.answerCount);
					}
					sum += el.answerCount;

					store.each(function (record, index) {
						var max = Math.max(maxValue, record.get('value'));
						// Scale axis to a bigger number. For example, 12 answers get a maximum scale of 20.
						maxValue = Math.ceil(max / 10) * 10;
					});

					var idx = tmpPossibleAnswers.indexOf(el.answerText); // Find the index
					if (idx !== -1) {
						// Remove it if really found!
						tmpPossibleAnswers.splice(idx, 1);
					}
				}
				if (abstentionCount) {
					record = store.findRecord('text', Messages.ABSTENTION, 0, false, true, true); // exact match
					if (!record) {
						store.add({text: Messages.ABSTENTION, value: abstentionCount});
					} else if (record.get('value') !== abstentionCount) {
						record.set('value', abstentionCount);
					}
				}

				// Calculate percentages
				if (panel.questionObj.questionType === "mc") {
					store.each(function (record) {
						var percent = Math.round((record.get('value') / mcTotalAnswerCount) * 100);
						record.set('percent', percent);
					});
				} else {
					var totalResults = store.sum('value');
					store.each(function (record) {
						var percent = Math.round((record.get('value') / totalResults) * 100);
						record.set('percent', percent);
					});
				}
				chart.getAxes()[0].setMaximum(maxValue);

				// renew the chart-data
				chart.redraw();

				if (ARSnova.app.userRole === ARSnova.app.USER_ROLE_SPEAKER) {
					// update quote in toolbar
					var quote = panel.toolbar.items.items[4];
					var users = quote.getHtml().split("/");
					users[0] = sum;
					users = users.join("/");
					quote.setHtml(users);
				}
			},
			failure: function () {
				console.log('server-side error');
			}
		});
	},

	countActiveUsers: function () {
		var count = ARSnova.app.loggedInModel.countActiveUsersBySession();

		// update quote in toolbar
		var quote = ARSnova.app.mainTabPanel._activeItem.toolbar.items.items[4];
		var users = quote.getHtml().split("/");
		users[1] = count - 1; // Do not count the speaker itself
		users = users.join("/");
		quote.setHtml(users);
	},

	showEmbeddedPagePreview: function (embeddedPage) {
		var controller = ARSnova.app.getController('Application'),
			me = this;

		embeddedPage.setBackHandler(function () {
			// remove & destroy embeddedPage and delete reference
			delete controller.embeddedPage;

			ARSnova.app.mainTabPanel.animateActiveItem(me, {
				type: 'slide',
				direction: 'right',
				duration: 700
			});
		});

		ARSnova.app.mainTabPanel.animateActiveItem(embeddedPage, {
			type: 'slide',
			direction: 'left',
			duration: 700
		});
	},

	setGradients: function () {
		this.correctAnswers = {};

		if (this.questionObj.questionType === "yesno" || this.questionObj.questionType === "mc"
				|| (this.questionObj.questionType === "abcd" && !this.questionObj.noCorrect)) {
			if (this.toggleCorrect) {
				this.gradients = this.getCorrectAnswerGradients();
			} else {
				this.gradients = this.getDefaultGradients();
			}
		} else {
			this.gradients = this.getDefaultGradients();
		}

		this.abstentionGradient = Ext.create('Ext.draw.gradient.Linear', {
			degrees: 90,
			stops: [
				{offset: 0, color: 'rgb(180, 180, 180)'},
				{offset: 100, color: 'rgb(150, 150, 150)'}
			]
		});
	},

	getCorrectAnswerGradients: function () {
		var data, question, gradients = [];

		for (var i = 0; i < this.questionObj.possibleAnswers.length; i++) {
			question = this.questionObj.possibleAnswers[i];
			data = question.data ? question.data : question;

			this.correctAnswers[data.text] = data.correct;

			if ((question.data && !question.data.correct) || (!question.data && !question.correct)) {
				gradients.push(
					Ext.create('Ext.draw.gradient.Linear', {
						degrees: 90,
						stops: [
							{offset: 0, color: 'rgb(151, 27, 47);'},
							{offset: 100, color: 'rgb(111, 7, 27)'}
						]
					})
				);
			} else {
				gradients.push(
					Ext.create('Ext.draw.gradient.Linear', {
						degrees: 90,
						stops: [
							{offset: 0, color: 'rgb(128, 186, 36)'},
							{offset: 100, color: 'rgb(88, 146, 0)'}
						]
					})
				);
			}
		}

		return gradients;
	},

	getDefaultGradients: function () {
		return [
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(22, 64, 128)'},
					{offset: 100, color: 'rgb(0, 14, 88)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(48, 128, 128)'},
					{offset: 100, color: 'rgb(8, 88, 88)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(128, 128, 25)'},
					{offset: 100, color: 'rgb(88, 88, 0)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(128, 28, 128)'},
					{offset: 100, color: 'rgb(88, 0, 88)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(215, 113, 1)'},
					{offset: 100, color: 'rgb(175, 73, 0)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(128, 64, 22)'},
					{offset: 100, color: 'rgb(88, 24, 0)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(64, 0, 128)'},
					{offset: 100, color: 'rgb(40, 2, 79)'}
				]
			}),
			Ext.create('Ext.draw.gradient.Linear', {
				degrees: 90,
				stops: [
					{offset: 0, color: 'rgb(150, 30, 0)'},
					{offset: 100, color: 'rgb(110, 0, 0)'}
				]
			})
		];
	}
});

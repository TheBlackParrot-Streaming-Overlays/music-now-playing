const musicChannel = new BroadcastChannel("music");

const musicFuncs = {
	track: function(data) {
		cycleAlbumArtist("artist");

		if(!data) {
			// what the fuck
			return;
		}

		if("uri" in data) {
			if(data.uri) { // wtf
				if(data.uri.length === 36 && data.uri.indexOf("spotify:") === 0) {
					fetchScannable(data);
				} else {
					$("#scannableWrapper").hide();
				}
			} else {
				$("#scannableWrapper").hide();
			}
		} else {
			$("#scannableWrapper").hide();
		}

		if(localStorage.getItem("setting_spotify_enableArt") === "true") { $("#artWrapper").show(); }

		const enableAnimations = (localStorage.getItem("setting_spotify_enableAnimations") === "true");
		const timespans = {
			small: (enableAnimations ? 100 : 0),
			medium: (enableAnimations ? 250 : 0),
			large: (enableAnimations ? 500 : 0)
		};
		const artistGradientEnabled = (localStorage.getItem("setting_spotify_artistGradient") === "true");

		currentSong = data;

		$("#detailsWrapper").addClass("fadeOut");
		$("#detailsWrapper").removeClass("fadeIn");

		$("#title").addClass("slideOut");
		$("#title").removeClass("slideIn");
		setTimeout(function() {
			$("#secondary").addClass("slideOut");
			$("#secondary").removeClass("slideIn");

			setTimeout(function() {
				$("#titleString").text(data.title);
				
				$("#artistString").empty();
				if(data.artists) {
					if(typeof data.artists[0] === "string") {
						const artistElement = $(`<div class="individualArtist"></div>`);
						const artistName = $(`<span class="artistName"></span>`).text(data.artists.join(", "));

						if(artistGradientEnabled) {
							artistName.addClass("artistStringGradient");
						}

						artistElement.append(artistName);
						$("#artistString").append(artistElement);
					} else {
						for(let artist of data.artists) {
							const artistElement = $(`<div class="individualArtist"></div>`);

							if(artist.image) {
								const artistImage = $(`<img class="artistImage"/>`);
								artistImage.attr("src", artist.image);
								artistElement.append(artistImage);
							}

							const artistName = $(`<span class="artistName"></span>`).text(artist.name);
							if(artistGradientEnabled) {
								artistName.addClass("artistStringGradient");
							}
							artistElement.append(artistName);

							$("#artistString").append(artistElement);
						}
						$(".individualArtist:not(:last)").addClass("showComma");
					}
				}
				
				$("#albumString").text(data.album.name.length > 0 ? data.album.name : "(unknown album)");
				
				if("labels" in data) {
					if(data.labels.length) {
						$("#labelString").text(data.labels.join(", "));
					}
				}

				if(data.album.year) {
					$("#yearString").show();
					$("#yearString").text(data.album.year);
				} else if(data.album.released) {
					$("#yearString").show();
					$("#yearString").text(data.album.released);
				} else {
					$("#yearString").hide();
				}

				$(":root").get(0).style.setProperty("--currentProgressAngle", '0deg');
				prevPerc = -1;
				elapsed = 0;
				updateProgress();

				$("#albumString").removeClass("isSingle");
				/*if(data.album.type === "single") {
					if(localStorage.getItem("setting_spotify_showSingleIfSingle") === "true") {
						$("#albumString").addClass("isSingle");
					}
				}*/

				try {
					let darkColor = data.album.art.colors.dark;
					let lightColor = data.album.art.colors.light;

					localStorage.setItem("art_darkColor", darkColor);
					localStorage.setItem("art_lightColor", lightColor);

					if(localStorage.getItem("setting_spotify_ensureColorIsBrightEnough") === "true") {
						darkColor = ensureSafeColor(darkColor);
						lightColor = ensureSafeColor(lightColor);
					}

					$(":root").get(0).style.setProperty("--colorDark", darkColor);
					$(":root").get(0).style.setProperty("--colorLight", lightColor);
				} catch(err) {
					if(err instanceof TypeError) {
						// ignore
					} else {
						console.error(err);
					}
				}

				$("#detailsWrapper").addClass("fadeIn")
				$("#detailsWrapper").removeClass("fadeOut");
				$("#title").addClass("slideIn")
				$("#title").removeClass("slideOut");
				
				setTimeout(function() {
					$("#secondary").removeClass("slideOut");
					$("#secondary").addClass("slideIn");
					updateSecondaryMarquee();
				}, timespans.small);

				if(localStorage.getItem("setting_spotify_enableArtistAlbumCycle") === "true") {
					albumArtistCycleTO = setTimeout(function() {
						cycleAlbumArtist("album");
					}, parseFloat(localStorage.getItem("setting_spotify_artistAlbumCycleDelay")) * 1000);
				}
				updateMarquee();
			}, timespans.large);
		}, timespans.small);

		setTimeout(function() {
			$("#artAnimationWrapper, #bgWrapper .artContainer").fadeOut(timespans.medium, function() {
				try {
					$("#art, #artLoader").attr("src", data.album.art.data);
					rootCSS().setProperty("--art-url", `url('${data.album.art.data}')`);
				} catch {
					$("#art, #artLoader").attr("src", "placeholder.png");
					rootCSS().setProperty("--art-url", `url('placeholder.png')`);
				}

				$("#artLoader").one({
					load: function() {
						$("#artAnimationWrapper").fadeIn(timespans.large);
						$("#bgWrapper .artContainer").fadeIn(parseFloat(localStorage.getItem("setting_spotify_artBackgroundFadeInDuration")) * 1000);
					},
					error: function() {
						$("#art, #artLoader").attr("src", "placeholder.png");
						rootCSS().setProperty("--art-url", `url('placeholder.png')`);
					}
				});
			});
		}, timespans.medium);

		setTimeout(function() {
			// i'm lazy, there's some animation conflict here and it is 6 in the morning and i am tired
			$("#title").removeClass("slideIn");
			$("#title").removeClass("slideOut");
			$("#detailsWrapper").removeClass("fadeIn");
			$("#detailsWrapper").removeClass("fadeOut");
			$("#secondary").removeClass("slideIn");
			$("#secondary").removeClass("slideOut");
		}, timespans.large * 3);
	},

	state: function(data) {
		elapsed = data.elapsed;

		if(localStorage.getItem("setting_spotify_hideOnPause") === "true") {
			if(data.playing && !currentSong.isPlaying) {
				// previously paused, now playing
				showStuff();
				wasPreviouslyPlaying = true;
			}
			if(!data.playing && currentSong.isPlaying) {
				// previously playing, now paused
				hideStuff();
				wasPreviouslyPlaying = false;
			}
		}

		if(data.playing && !currentSong.isPlaying && "album" in currentSong) {
			if("art" in currentSong.album) {
				// previously paused, now playing
				try {
					let darkColor = currentSong.album.art.colors.dark;
					let lightColor = currentSong.album.art.colors.light;

					if(localStorage.getItem("setting_spotify_ensureColorIsBrightEnough") === "true") {
						darkColor = ensureSafeColor(darkColor);
						lightColor = ensureSafeColor(lightColor);
					}

					localStorage.setItem("art_darkColor", darkColor);
					localStorage.setItem("art_lightColor", lightColor);
				} catch(err) {
					console.error(err);
				}
			}
		}

		currentSong.isPlaying = data.playing;

		updateProgress();
	}
};

musicChannel.onmessage = function(message) {
	message = message.data;
	//console.log(message);

	if(message.event in musicFuncs) {
		musicFuncs[message.event](message.data);
	}
};
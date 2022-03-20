Waifus = function() {
    var scenes = [];
    var images = [];
    var PE = {};
    var currentSceneId = 0;
    var currentReplyId = 0;
    var init = function(scriptUrlOrData, defaultStats) {
        var promise = new Promise (function(resolve, reject) {
            if (typeof scriptUrlOrData == "object") {
                scenes = scriptUrlOrData.scenes;
                images = scriptUrlOrData.images;
                PE = defaultStats; //{food: 5, karma: 5, sleep: 5, luck: 5, courage: 5};
                currentSceneId = 0;
                currentReplyId = 0;
                resolve(getScene());
                resolve(getScene());
                return;
            }
            let xhr = new XMLHttpRequest();
            xhr.open("GET", scriptUrlOrData);
            xhr.onreadystatechange = (function(){
                if (this.status == 200 && this.readyState == XMLHttpRequest.DONE) {
                    let script = JSON.parse(this.response);
                    scenes = script.scenes;
                    images = script.images;
                    PE = defaultStats; //{food: 5, karma: 5, sleep: 5, luck: 5, courage: 5};
                    currentSceneId = 0;
                    currentReplyId = 0;
                    resolve(getScene());
                }
            });
            xhr.send();
        });
        return promise;
    };
    var getScene = function() {
        let choices = [];
        if (scenes[currentSceneId].choices && scenes[currentSceneId].replies.length-1 <= currentReplyId)
            for (let choice of scenes[currentSceneId].choices) {
                if (testCondition(choice.condition))
                    choices.push(choice);
            }
        return {
            background: scenes[currentSceneId].background!==undefined ? images[scenes[currentSceneId].background] : undefined,
            text: scenes[currentSceneId].replies[currentReplyId].text,
            speaker: scenes[currentSceneId].replies[currentReplyId].speaker,
            color: scenes[currentSceneId].replies[currentReplyId].color,
            image: scenes[currentSceneId].replies[currentReplyId].image!==undefined ? images[scenes[currentSceneId].replies[currentReplyId].image] : undefined,
            choices: choices,
            player: PE
        };
    };
    var testCondition = function(condition) {
        if (!condition) return true;
        with (PE) return (eval(condition));
    };
    var applyEffect = function(effect) {
        if (!effect) return;
        with (PE) eval(effect);
    };
    var nextReply = function() {
        currentReplyId++;
        if (currentReplyId < scenes[currentSceneId].replies.length) return getScene();
        else if (scenes[currentSceneId].atEnd == "redirect") {
            goToScene(scenes[currentSceneId].redirect);
            return getScene();
        } else return null;
    };
    var goToScene = function(id) {
        currentSceneId = id;
        currentReplyId = 0;
        
    };
    var nextScene = function(choiceId=null) {
        if (choiceId == null) {
            let choices = [];
            for (let choice of scenes[currentSceneId].choices) {
                if (testCondition(choice.condition))
                    choices.push(choice);
            }
            if (choices.length == 0) {
                console.info("[Waifus] Aucun choix possible OmG");
                return null;
            }
            let choice = choices[parseInt(Math.random()*choices.length)];
            applyEffect(choice.effect);
            goToScene(choice.id);
        } else {
            if (testCondition(scenes[currentSceneId].choices[choiceId].condition)) {
                applyEffect(scenes[currentSceneId].choices[choiceId].effect);
                goToScene(scenes[currentSceneId].choices[choiceId].id);
            } else {
                console.info("[Waifus] Impossible d'effectuer ce choix");
                return null;
            }
        }
        return getScene();
    };
    return {
        init: init,
        nextReply: nextReply,
        nextScene: nextScene,
        getScene: getScene
    };
}();

WaifusDisplayer = function() {
    var waifus = null;
    var waifusDiv = null;
    var init = function(waifus_=Waifus, id="waifus", fullscreen=false) {
        waifus = waifus_;
        waifusDiv = document.getElementById(id);
        if (waifusDiv)
            waifusDiv.innerHTML = '<div class="images"></div> <ul class="choices"></ul> <fieldset class="speech-zone"> <legend class="speaker"></legend> <span class="speech"></span> </fieldset>';
        if (waifus)
            waifusDiv.addEventListener("click", function() {
                let scene = waifus.nextReply();
                if (scene) displayScene(scene);
            });
        if (waifus)
            displayScene(waifus.getScene());
        if (fullscreen) {
            var fsButton = document.createElement("img");
            fsButton.src = "fullscreen.svg";
            fsButton.className = "fullscreen-button";
            fsButton.addEventListener("click", function() {
                waifusDiv.requestFullscreen();
            });
            waifusDiv.appendChild(fsButton);
            document.addEventListener("fullscreenchange", function() {
                fsButton.style.display = document.fullscreenElement==waifusDiv ? "none" : "";
            });
        }
    };
    var displayScene = function(scene) {
        if (!waifusDiv) {
            console.error("[WaifusDisplayer] No waifus-div");
            return false;
        }
        waifusDiv.style.backgroundImage = scene.background ? "url('"+scene.background+"')" : "";
        waifusDiv.getElementsByClassName("speech")[0].innerText = scene.text || "";
        waifusDiv.getElementsByClassName("speaker")[0].innerText = scene.speaker || "";
        waifusDiv.getElementsByClassName("speaker")[0].style.backgroundColor = scene.color || "";
        waifusDiv.getElementsByClassName("speaker")[0].style.display = (scene.speaker) ? "" : "none";
        for (let oldImageC of waifusDiv.getElementsByClassName("image-container")) {
            oldImageC.style.opacity = 0;
            let oic = oldImageC;
            setTimeout(function() {
                if (!oic.parentElement) oic.parentElement.removeChild(oic);
            }, 1000*parseFloat(getComputedStyle(oic).transitionDuration.match(/([0-9]*\.[0-9]+|[0-9]+)/)[0]));
        }
        if (scene.image) {
            let newImageC = document.createElement("div");
            newImageC.className = "image-container";
            newImageC.style.backgroundImage = "url('"+scene.image+"')";
            waifusDiv.getElementsByClassName("images")[0].appendChild(newImageC);
            getComputedStyle(newImageC).opacity; // force reflow
            newImageC.style.opacity = 1;
        }
        //waifusDiv.getElementsByClassName("image-container")[0].style.display = (scene.image) ? "" : "none";
        let choicesUl = waifusDiv.getElementsByClassName("choices")[0];
        choicesUl.innerHTML = "";
        choicesUl.style.display = scene.choices && scene.choices.length > 0 ? "" : "none";
        if (scene.choices)
            for (let choice of scene.choices) {
                let choiceLi = document.createElement("li");
                choiceLi.innerText = choice.text;
                choicesUl.appendChild(choiceLi);
                let choiceIndex = scene.choices.indexOf(choice);
                if (waifus) choiceLi.addEventListener("click", function(e) {
                    displayScene(waifus.nextScene(choiceIndex));
                    e.stopPropagation();
                });
            }
        return true;
    };
    return {
        init: init,
        displayScene: displayScene
    };
}();
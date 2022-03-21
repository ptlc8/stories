Story = function() {
    var logError = function(error) {
        console.error("[Story] "+error);
    };
    var logInfo = function(info) {
        console.info("[Story] "+info);
    };
    var createFromScriptUrl = function(scriptUrl) {
        return new Promise(function(resolve, reject) {
            let xhr = new XMLHttpRequest();
            xhr.open("GET", scriptUrl);
            xhr.onreadystatechange = (function(){
                if (this.status == 200 && this.readyState == XMLHttpRequest.DONE) {
                    resolve(create(JSON.parse(this.response)));
                }
            });
            xhr.send();
        });
    };
    var create = function(scriptData) {
        var scenes = scriptData.scenes || [];
        var images = scriptData.images || [];
        var vars = scriptData.vars || {};
        var currentSceneId = 0;
        var currentReplyId = 0;
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
                vars: vars
            };
        };
        var getValue = function(value) {
            if (value.var) {
                if (!vars[value.var])
                    return void logError("Variable inexistante : "+value.var);
                if (vars[value.var].type!="int")
                    return void logError("Variable de type non-entier : "+value.var);
                return vars[value.var].value;
            }
            if (value.op) {
                switch(value.op) {
                    case "+":
                        return getValue(value.a) + getValue(value.b);
                    case "-":
                        return getValue(value.a) - getValue(value.b);
                    case "*":
                        return getValue(value.a) * getValue(value.b);
                    case "%":
                        return getValue(value.a) % getValue(value.b);
                    default:
                        return void logError("Opérateur arithmétique inconnu : "+value.op);
                }
            }
            return value;
        };
        var testCondition = function(condition) {
            if (condition===undefined) return true;
            if (condition.var) {
                if (!vars[condition.var])
                    return void logError("Variable inexistante : "+condition.var);
                if (vars[condition.var].type!="boolean")
                    return void logError("Variable de type non-booléen : "+condition.var);
                return vars[condition.var].value;
            }
            if (condition.op) {
                switch(condition.op) {
                    case "<":
                        return getValue(condition.a) < getValue(condition.b);
                    case ">":
                        return getValue(condition.a) > getValue(condition.b);
                    case "==":
                        return getValue(condition.a) == getValue(condition.b);
                    case "!=":
                        return getValue(condition.a) != getValue(condition.b);
                    case ">=":
                        return getValue(condition.a) >= getValue(condition.b);
                    case "<=":
                        return getValue(condition.a) <= getValue(condition.b);
                    case "!":
                        return !testCondition(condition.a);
                    case "&&":
                        return testCondition(condition.a) && testCondition(condition.b);
                    case "||":
                        return testCondition(condition.a) || testCondition(condition.b);
                    default:
                        return void logError("Opérateur de comparaison ou logique inconnu : "+condition.op);
                }
            }
            return condition;
        };
        var applyEffect = function(effect) {
            if (!effect) return;
            switch(effect.op) {
                case "set":
                    if (!vars[effect.a])
                        return void logError("Variable inexistante : "+effect.a);
                    if (vars[effect.a].type=="int")
                        vars[effect.a].value = getValue(effect.b);
                    else if (vars[effect.a].type="boolean")
                        vars[effect.a].value = testCondition(effect.b);
                    else
                        logError("Type de variable non-mutable : "+vars[effect.a].type);
                    return;
                default:
                    return void logError("Opérateur d'effet inconnu : "+effect.op);
            }
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
                    logInfo("Aucun choix possible OmG");
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
                    logInfo("Impossible d'effectuer ce choix");
                    return null;
                }
            }
            return getScene();
        };
        var getVars = function() {
            return vars;
        };
        return {
            nextReply: nextReply,
            nextScene: nextScene,
            getScene: getScene,
            getVars: getVars
        };
    };
    return {create, createFromScriptUrl};
}();

StoryDisplayer = function() {
    var create = function(story_, storyDiv_, fullscreen=false) {
        var story = story_;
        var storyDiv = storyDiv_;
        var debug = true;
        var displayScene = function(scene) {
            if (!storyDiv) {
                console.error("[StoryDisplayer] No story-div");
                return false;
            }
            storyDiv.style.backgroundImage = scene.background ? "url('"+scene.background+"')" : "";
            storyDiv.getElementsByClassName("speech")[0].innerText = scene.text || "";
            storyDiv.getElementsByClassName("speaker")[0].innerText = scene.speaker || "";
            storyDiv.getElementsByClassName("speaker")[0].style.backgroundColor = scene.color || "";
            storyDiv.getElementsByClassName("speaker")[0].style.display = (scene.speaker) ? "" : "none";
            let oldImageC = storyDiv.getElementsByClassName("image")[0];
            if ((oldImageC==undefined&&scene.image)||(oldImageC!=undefined && (!oldImageC.style.backgroundImage.includes(scene.image)))) {
                if (oldImageC) {
                    oldImageC.style.opacity = 0;
                    oldImageC.className = "old-image";
                    setTimeout(function() {
                        if (oldImageC.parentElement && oldImageC.style.backgroundImage!="url('"+scene.image+"')")
                            oldImageC.parentElement.removeChild(oldImageC);
                    }, 1000*parseFloat(getComputedStyle(oldImageC).transitionDuration.match(/([0-9]*\.[0-9]+|[0-9]+)/)[0]));
                }
                if (scene.image) {
                    let newImageC = createElement("div", {className:"image", style:{backgroundImage:"url('"+scene.image+"')"}});
                    storyDiv.getElementsByClassName("images")[0].appendChild(newImageC);
                    getComputedStyle(newImageC).opacity; // force reflow
                    newImageC.style.opacity = 1;
                }
            }
            let choicesUl = storyDiv.getElementsByClassName("choices")[0];
            choicesUl.innerHTML = "";
            choicesUl.style.display = scene.choices && scene.choices.length > 0 ? "" : "none";
            if (scene.choices)
                for (let choice of scene.choices) {
                    let choiceIndex = scene.choices.indexOf(choice);
                    choicesUl.appendChild(createElement("li", {}, choice.text, {click:function(e){
                        if (story)
                            displayScene(story.nextScene(choiceIndex));
                        e.stopPropagation();
                    }}));
                }
            refreshVars();
            return true;
        };
        var refreshVars = function() {
            if (!story) return;
            varsDiv = storyDiv.getElementsByClassName("vars")[0];
            for (const [name,variable] of Object.entries(story.getVars())) {
                if (variable.public) {
                    let varDiv = varsDiv.getElementsByClassName("var-"+name)[0];
                    if (varDiv)
                        varDiv.children[0].children[0].style.height = variable.value/variable.max*100+"%";
                    else varsDiv.appendChild(createElement("div", {className:"var-"+name}, [
                        createElement("div", {}, [
                            createElement("div", {style:{backgroundColor:variable.color,height:variable.value/variable.max*100+"%"}})
                        ]),
                        createElement("span", {}, name)
                    ]));
                }
            }
            if (debug) {
                for (const [name,variable] of Object.entries(story.getVars())) {
                    if (!variable.public) {
                        let varDiv = varsDiv.getElementsByClassName("var-"+name)[0];
                        if (varDiv)
                            varDiv.innerText = name+" : "+variable.value;
                        else varsDiv.appendChild(createElement("span", {className:"var-"+name}, name+" : "+variable.value));
                    }
                }
            }
        };
        // init
        if (storyDiv) {
            storyDiv.classList.add("story");
            storyDiv.innerHTML = '<div class="images"></div> <ul class="choices"></ul> <fieldset class="speech-zone"> <legend class="speaker"></legend> <span class="speech"></span> </fieldset> <div class="vars"></div>';
        }
        if (storyDiv && story)
            storyDiv.addEventListener("click", function() {
                let scene = story.nextReply();
                if (scene) displayScene(scene);
            });
        if (story)
            displayScene(story.getScene());
        if (fullscreen) {
            let fullscreenButton = createElement("img", {src:"fullscreen.svg", className:"fullscreen-button"}, [], {click:function(){
                storyDiv.requestFullscreen();
            }});
            storyDiv.appendChild(fullscreenButton);
            document.addEventListener("fullscreenchange", function() {
                fullscreenButton.style.display = document.fullscreenElement==storyDiv ? "none" : "";
            });
        }
        return {displayScene};
    };
    return {create};
}();

// fonction utile d'Ambi
function createElement(tag, properties={}, inner=[], eventListeners={}) {
    let el = document.createElement(tag);
    for (let p of Object.keys(properties)) if (p != "style") el[p] = properties[p];
    if (properties.style) for (let p of Object.keys(properties.style)) el.style[p] = properties.style[p];
    if (properties.dataset) for (let p of Object.keys(properties.dataset)) el.dataset[p] = properties.dataset[p];
    if (typeof inner == "object") for (let i of inner) el.appendChild(typeof i == "string" ? document.createTextNode(i) : i);
    else el.innerText = inner;
    for (let l of Object.keys(eventListeners)) el.addEventListener(l, eventListeners[l]);
    return el;
}
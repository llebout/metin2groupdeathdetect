'use strict';

const preferredDisplaySurface = document.getElementById('displaySurface');
const startButton = document.getElementById('startButton');
const clearButton = document.getElementById('clearButton');

var monitoredPixelsDisplay = document.getElementById('monitoredPixels');

var pixelatedZoomCtx = document.getElementById('pixelated-zoom').getContext('2d');
pixelatedZoomCtx.imageSmoothingEnabled = false;
pixelatedZoomCtx.mozImageSmoothingEnabled = false;
pixelatedZoomCtx.webkitImageSmoothingEnabled = false;
pixelatedZoomCtx.msImageSmoothingEnabled = false;

var pixelatedMismatchZoomCtx = document.getElementById('pixelated-mismatch-zoom').getContext('2d');
pixelatedMismatchZoomCtx.imageSmoothingEnabled = false;
pixelatedMismatchZoomCtx.mozImageSmoothingEnabled = false;
pixelatedMismatchZoomCtx.webkitImageSmoothingEnabled = false;
pixelatedMismatchZoomCtx.msImageSmoothingEnabled = false;

const hoveredColor = document.getElementById("hovered-color");
const selectedColor = document.getElementById("selected-color");

const correctColor = document.getElementById("correct-color");
const mismatchColor = document.getElementById("mismatch-color");

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d", {willReadFrequently: true});

let monitoredPixels = JSON.parse(localStorage.getItem("monitoredPixels"));

if (monitoredPixels == null) {
    monitoredPixels = [];
    localStorage.setItem("monitoredPixels", JSON.stringify(monitoredPixels));
} else {
    monitoredPixelsDisplay.textContent = monitoredPixels.length;
}

if (adapter.browserDetails.browser === 'chrome' &&
    adapter.browserDetails.version >= 107) {
    // See https://developer.chrome.com/docs/web-platform/screen-sharing-controls/
    //document.getElementById('options').style.display = 'block';
} else if (adapter.browserDetails.browser === 'firefox') {
    // Polyfill in Firefox.
    // See https://blog.mozilla.org/webrtc/getdisplaymedia-now-available-in-adapter-js/
    adapter.browserShim.shimGetDisplayMedia(window, 'screen');
}

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) / (rect.right - rect.left) * canvas.width,
        y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * canvas.height
    };
}

function beep() {
    var snd = new Audio("audio/alarm.wav")
    snd.play()
}

function handleSuccess(stream) {
    startButton.disabled = true;
    const video = document.querySelector('video');
    video.srcObject = stream;
    var deadCheck;

    video.addEventListener('canplay', (ev) => {
        var lastmousevent;

        function pick(ctx, event, destination) {
            lastmousevent = event;
            const { x, y } = getMousePos(canvas, event);
            const pixel = ctx.getImageData(x, y, 1, 1);
            const data = pixel.data;

            const rgbColor = `rgb(${data[0]} ${data[1]} ${data[2]} / ${data[3] / 255})`;
            destination.style.background = rgbColor;
            destination.textContent = rgbColor;

            return rgbColor;
        }

        function getPixelColor(ctx, event) {
            const { x, y } = getMousePos(canvas, event);
            const pixel = ctx.getImageData(x, y, 1, 1);
            return pixel.data;
        }

        var zoom = function (ctx, event) {
            const { x, y } = getMousePos(canvas, event);
            ctx.drawImage(canvas,
                Math.min(Math.max(0, x - 5), canvas.width - 10),
                Math.min(Math.max(0, y - 5), canvas.height - 10),
                10, 10,
                0, 0,
                100, 100);
        };

        canvas.addEventListener("mousemove", (event) => zoom(pixelatedZoomCtx, event));
        canvas.addEventListener("mousemove", (event) => pick(context, event, hoveredColor));
        canvas.addEventListener("click", (event) => {
            monitoredPixels.push({ event: { clientX: event.clientX, clientY: event.clientY }, pixel: getPixelColor(context, event) });
            monitoredPixelsDisplay.textContent = monitoredPixels.length;
            localStorage.setItem("monitoredPixels", JSON.stringify(monitoredPixels));
        });

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        console.log(`video.width: ${canvas.width}, video.height: ${canvas.height}`);

        console.log("start deadCheck");
        deadCheck = setInterval(() => {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (lastmousevent != undefined) {
                pick(context, lastmousevent, hoveredColor);
                zoom(pixelatedZoomCtx, lastmousevent);
            }
            for (const x of monitoredPixels) {
                let { event, pixel } = x;

                let currentPixel = getPixelColor(context, event);
                if (currentPixel[0] != pixel[0] || currentPixel[1] != pixel[1] || currentPixel[2] != pixel[2]) {
                    let rgbColor = `rgb(${pixel[0]} ${pixel[1]} ${pixel[2]} / ${pixel[3] / 255})`;
                    correctColor.style.background = rgbColor;
                    correctColor.textContent = rgbColor;

                    rgbColor = `rgb(${currentPixel[0]} ${currentPixel[1]} ${currentPixel[2]} / ${currentPixel[3] / 255})`;
                    mismatchColor.style.background = rgbColor;
                    mismatchColor.textContent = rgbColor;

                    zoom(pixelatedMismatchZoomCtx, event);
                    beep();
                    break;
                }
            }
        }, 1000);
    });

    // demonstrates how to detect that the user has stopped
    // sharing the screen via the browser UI.
    stream.getVideoTracks()[0].addEventListener('ended', () => {
        clearInterval(deadCheck);
        errorMsg('The user has ended sharing the screen');
        startButton.disabled = false;
    });

}

function handleError(error) {
    errorMsg(`getDisplayMedia error: ${error.name}`, error);
}

function errorMsg(msg, error) {
    const errorElement = document.querySelector('#errorMsg');
    errorElement.innerHTML += `<p>${msg}</p>`;
    if (typeof error !== 'undefined') {
        console.error(error);
    }
}

clearButton.addEventListener('click', () => {
    monitoredPixels = [];
    monitoredPixelsDisplay.textContent = monitoredPixels.length;
    localStorage.setItem("monitoredPixels", JSON.stringify(monitoredPixels));
});
startButton.addEventListener('click', () => {
    const options = { audio: false, video: true };
    const displaySurface = preferredDisplaySurface.options[preferredDisplaySurface.selectedIndex].value;
    if (displaySurface !== 'default') {
        options.video = { displaySurface };
    }
    navigator.mediaDevices.getDisplayMedia(options)
        .then(handleSuccess, handleError);
});

if ((navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices)) {
    startButton.disabled = false;
} else {
    errorMsg('getDisplayMedia is not supported');
}

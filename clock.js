const clock = document.getElementById('clock-display');
setInterval(() => {
        if(clock) clock.innerText = new Date().toLocaleTimeString();
    }, 1000);
setTimeout(() => {
    document.body.classList.remove('loading');
    document.body.classList.add('loaded');
}, 2500);
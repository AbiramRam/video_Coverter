const socket = io();
let currentSocketId = null; // Track current socket ID for cancellation

document.getElementById('uploadForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append('video', document.getElementById('video').files[0]);
    formData.append('format', document.getElementById('format').value);
    formData.append('socketId', socket.id);

    const progressBar = document.getElementById('progress-bar');
    const progressContainer = document.getElementById('progress-container');
    const message = document.getElementById('message');
    const cancelButton = document.getElementById('cancelButton');

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    message.textContent = '';
    cancelButton.style.display = 'none'; // Hide cancel button initially

    socket.on('conversionProgress', (percent) => {
        progressBar.style.width = `${percent}%`;
        progressBar.textContent = `${Math.round(percent)}%`;
    });

    socket.on('conversionComplete', (outputFile) => {
        progressBar.style.width = '100%';
        progressBar.textContent = '100%';
        message.textContent = 'Conversion successful!';

        const a = document.createElement('a');
        a.href = `/download?file=${outputFile}`;
        a.download = `converted.${document.getElementById('format').value}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        cancelButton.style.display = 'none'; // Hide cancel button after conversion
    });

    socket.on('conversionError', (error) => {
        progressBar.style.width = '0%';
        message.textContent = error;
        cancelButton.style.display = 'none'; // Hide cancel button on error
    });

    try {
        const response = await fetch('/convert', {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            message.textContent = 'Conversion failed. Please try again.';
        } else {
            currentSocketId = socket.id; // Store current socket ID for cancellation
            cancelButton.style.display = 'inline-block'; // Show cancel button
        }
    } catch (error) {
        console.error('Error:', error);
        message.textContent = 'An error occurred. Please try again.';
    }
});

document.getElementById('cancelButton').addEventListener('click', async function(event) {
    event.preventDefault();

    try {
        const response = await fetch('/cancel', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ socketId: currentSocketId })
        });

        if (response.ok) {
            console.log('Conversion cancelled');
            message.textContent = 'Conversion cancelled by user.';
            progressBar.style.width = '0%';
            progressBar.textContent = '';
            cancelButton.style.display = 'none'; // Hide cancel button
        } else {
            const errorMessage = await response.text();
            console.error('Failed to cancel conversion:', errorMessage);
            message.textContent = 'Failed to cancel conversion. Please try again.';
        }
    } catch (error) {
        console.error('Error:', error);
        message.textContent = 'An error occurred while cancelling conversion.';
    }
});

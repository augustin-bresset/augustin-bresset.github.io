function init() {
    // Navbar Scroll Effect
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(10, 10, 10, 0.95)';
            navbar.style.boxShadow = '0 10px 30px -10px rgba(2, 12, 27, 0.7)';
        } else {
            navbar.style.background = 'rgba(10, 10, 10, 0.85)';
            navbar.style.boxShadow = 'none';
        }
    });

    // Reveal on Scroll
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('fade-up');
        observer.observe(section);
    });
}

// Add simple fade animation CSS dynamically or rely on style.css if I added it?
// I didn't add the .fade-up class styles in CSS yet, so let's quickly add them to style.css or here.
// Actually, let's keep it simple. I'll rely on the CSS transitions I already put in elements or add a small block here if needed.
// But wait, I missed the specific .fade-up CSS in the big CSS file. 
// I will append it to the CSS file in the next step to ensure the JS works beautifully.

document.addEventListener('DOMContentLoaded', init);

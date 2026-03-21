/* ==========================================================================
   VAZHITRACKER | MICRO-INTERACTIONS & ANIMATIONS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. MAGNETIC BUTTONS (The Silicon Valley Pull Effect) ---
    const magneticButtons = document.querySelectorAll('.magnetic-btn');

    magneticButtons.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            // Calculate mouse position relative to the center of the button
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Pull the button towards the cursor (0.3 is the magnetic strength)
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });

        btn.addEventListener('mouseleave', () => {
            // Snap back to perfectly center when the mouse leaves
            btn.style.transform = `translate(0px, 0px)`;
        });
    });

    // --- 2. TRUE 3D BENTO BOX TILT (Apple Style) ---
    const cards3D = document.querySelectorAll('.hover-3d');

    cards3D.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left; 
            const y = e.clientY - rect.top;  

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Calculate exact tilt angles based on mouse coordinates
            const rotateX = ((y - centerY) / centerY) * -4; // Max 4 degree tilt
            const rotateY = ((x - centerX) / centerX) * 4;

            // Apply the 3D rotation instantly
            card.style.transition = 'none'; 
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
            
            // Optional: Make the border glow follow the mouse
            card.style.borderColor = "rgba(255, 255, 255, 0.2)";
        });

        card.addEventListener('mouseleave', () => {
            // Smoothly snap back to flat when mouse leaves
            card.style.transition = 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
            card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
            card.style.borderColor = "rgba(255, 255, 255, 0.08)";
        });
    });

    // --- 3. SCROLL REVEAL ANIMATIONS (Glide In) ---
    // We grab the main elements and hide them initially
    const elementsToReveal = document.querySelectorAll('.bento-card, .hero-text, .hero-visual, .section-heading');
    
    elementsToReveal.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(40px)';
        el.style.transition = 'all 0.8s cubic-bezier(0.23, 1, 0.32, 1)';
    });

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // When they scroll into view, glide them up!
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    elementsToReveal.forEach(el => revealObserver.observe(el));
    
    // --- 4. DYNAMIC NAVBAR GLASS EFFECT ---
    const header = document.querySelector('.glass-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.background = 'rgba(5, 5, 5, 0.85)';
            header.style.boxShadow = '0 10px 30px rgba(0,0,0,0.8)';
        } else {
            header.style.background = 'rgba(5, 5, 5, 0.7)';
            header.style.boxShadow = 'none';
        }
    });

});
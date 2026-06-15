Brand fonts for exact rendering fidelity
========================================
The Letter of Offer uses Georgia (headlines) and Calibri (body). To make the
server render pixel-identical to Word, drop the licensed font files here before
building the Docker image:

    Georgia.ttf, Georgiab.ttf (bold), Georgiai.ttf (italic), Georgiaz.ttf (bold italic)
    Calibri.ttf, Calibrib.ttf, Calibrii.ttf, Calibriz.ttf

You already own these via Microsoft Office / Windows (typically C:\Windows\Fonts).
Copy them into this folder; the Dockerfile installs them and refreshes the font cache.

If you cannot supply them, the image still builds: Calibri falls back to Carlito
(metric-compatible, installed automatically) and Georgia falls back to a serif
substitute. Layout stays correct; glyph shapes differ slightly.

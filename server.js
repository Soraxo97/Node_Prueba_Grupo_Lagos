const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

// Configuración del servidor y caché
const app = express();
const PORT = 3001;
const cache = new NodeCache({ stdTTL: 3600 }); // TTL de 3600 segundos (1 hora)
app.use(cors()); // Habilitar CORS
app.use(express.json());

// Middleware para actualizar el caché en cada conexión
app.use((req, res, next) => {
    // Aquí puedes definir la lógica para actualizar el caché
    // Por ejemplo, si quieres limpiar el caché o hacer otra lógica
    next(); // Llama al siguiente middleware o ruta
});

// Endpoint para obtener las canciones de una banda
app.get('/search_tracks', async (req, res) => {
    const bandName = req.query.name;

    // Revisa si los datos están en caché
    const cacheKey = `search_${bandName}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return res.json(cachedData); // Retorna datos en caché si existen
    }

    // Si no hay datos en caché, realizar la consulta a la API
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(bandName)}`;

    try {
        const response = await axios.get(url);
        const results = response.data.results;

        // Filtra solo las canciones del artista exacto y el tipo "track"
        const songs = results.filter(result => 
            result.wrapperType === 'track' && 
            result.kind === 'song' &&
            result.artistName.toLowerCase() === bandName.toLowerCase()
        );

        // Limita a los primeros 25 registros
        const limitedSongs = songs.slice(0, 25);

        // Calcula los álbumes únicos
        const albums = new Set(limitedSongs.map(song => song.collectionName));
        
        // Formatea las canciones en el formato solicitado
        const formattedSongs = limitedSongs.map(song => ({
            cancion_id: song.trackId,
            nombre_album: song.collectionName,
            nombre_tema: song.trackName,
            preview_url: song.previewUrl,
            fecha_lanzamiento: song.releaseDate,
            precio: {
                valor: song.trackPrice,
                moneda: song.currency
            }
        }));

        // Estructura de la respuesta
        const responseData = {
            total_albumes: albums.size,
            total_canciones: formattedSongs.length,
            albumes: Array.from(albums),
            canciones: formattedSongs
        };

        // Guarda en caché la respuesta
        cache.set(cacheKey, responseData);

        // Envía la respuesta
        res.json(responseData);

    } catch (error) {
        console.error("Error al consultar la API de iTunes:", error);
        res.status(500).json({ error: "Error al consultar la API de iTunes" });
    }
});


// Estructura temporal para almacenar las canciones favoritas
const favoritos = [];

// Endpoint para agregar o quitar una canción de favoritos
app.post('/favoritos', (req, res) => {
    const { nombre_banda, cancion_id, usuario, ranking } = req.body;

    // Validación de la entrada
    if (!nombre_banda || !cancion_id || !usuario || !ranking) {
        return res.status(400).json({ error: "Datos incompletos en la solicitud" });
    }

    // Verifica si la canción ya está en favoritos
    const existingFavoriteIndex = favoritos.findIndex(fav => fav.cancion_id === cancion_id && fav.nombre_banda.toLowerCase() === nombre_banda.toLowerCase());

    if (existingFavoriteIndex >= 0) {
        // Si la canción ya está en favoritos, la eliminamos
        favoritos.splice(existingFavoriteIndex, 1);
        return res.status(200).json({ message: "Canción desmarcada como favorita" });
    }

    // Agrega la canción a la lista de favoritos
    favoritos.push({ nombre_banda, cancion_id, usuario, ranking });
    res.status(201).json({ message: "Canción marcada como favorita" });
});

// Endpoint para obtener las canciones favoritas
app.get('/favoritos', (req, res) => {
    // Devuelve la lista de favoritos
    res.json(favoritos);
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

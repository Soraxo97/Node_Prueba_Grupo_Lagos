const express = require('express');
const axios = require('axios');
const cors = require('cors');
const NodeCache = require('node-cache');

// Configuración del servidor y caché
const app = express();
const PORT = 3001;
const cache = new NodeCache({ stdTTL: 3600 }); // TTL de 3600 segundos (1 hora)
app.use(cors()); // Habilitar CORS
app.use(express.json()); // Middleware para parsear JSON en las solicitudes

// Middleware para actualizar el caché en cada conexión (lógica adicional puede ser añadida aquí)
app.use((req, res, next) => {
    next(); // Llama al siguiente middleware o ruta
});

// Endpoint para obtener las canciones de una banda
app.get('/search_tracks', async (req, res) => {
    const bandName = req.query.name; // Obtiene el nombre de la banda de los parámetros de consulta

    if (!bandName) {
        return res.status(400).json({ error: "El nombre de la banda es requerido." }); // Manejo de errores si no se proporciona nombre de banda
    }

    // Revisa si los datos están en caché
    const cacheKey = `search_${bandName}`; // Clave única para almacenar los resultados en caché
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
        return res.json(cachedData); // Retorna datos en caché si existen
    }

    // Si no hay datos en caché, realizar la consulta a la API de iTunes
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(bandName)}&limit=25`;

    try {
        const response = await axios.get(url); // Realiza la solicitud GET
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
                valor: song.trackPrice || "N/A", // Asegúrate de manejar casos sin precio
                moneda: song.currency
            }
        }));

        // Estructura de la respuesta
        const responseData = {
            total_albumes: albums.size, // Total de álbumes únicos
            total_canciones: formattedSongs.length, // Total de canciones
            albumes: Array.from(albums), // Lista de nombres de álbumes únicos
            canciones: formattedSongs // Lista de canciones formateadas
        };

        // Guarda en caché la respuesta
        cache.set(cacheKey, responseData);

        // Envía la respuesta
        res.json(responseData);

    } catch (error) {
        console.error("Error al consultar la API de iTunes:", error); // Manejo del error
        res.status(500).json({ error: "Error al consultar la API de iTunes" }); // Respuesta en caso de error
    }
});

// Estructura temporal para almacenar las canciones favoritas
const favoritos = [];

// Endpoint para agregar o quitar una canción de favoritos
app.post('/favoritos', (req, res) => {
    const { nombre_banda, cancion_id, usuario, ranking } = req.body; // Desestructura los datos del cuerpo de la solicitud

    // Validación de la entrada
    if (!nombre_banda || !cancion_id || !usuario || !ranking) {
        return res.status(400).json({ error: "Datos incompletos en la solicitud" }); // Respuesta de error por datos incompletos
    }

    // Imprimir los datos recibidos en la consola
    console.log("Datos recibidos:", {
        nombre_banda,
        cancion_id,
        usuario,
        ranking
    });

    // Verifica si la canción ya está en favoritos
    const existingFavoriteIndex = favoritos.findIndex(fav => fav.cancion_id === cancion_id && fav.nombre_banda.toLowerCase() === nombre_banda.toLowerCase());

    if (existingFavoriteIndex >= 0) {
        // Si la canción ya está en favoritos, la eliminamos
        const removedSong = favoritos[existingFavoriteIndex]; // Guarda la canción eliminada
        favoritos.splice(existingFavoriteIndex, 1);
        return res.status(200).json({ 
            message: "Canción desmarcada como favorita",
            ...removedSong // Incluye la información de la canción eliminada en la respuesta
        });
    }

    // Agrega la canción a la lista de favoritos
    const newFavorite = { nombre_banda, cancion_id, usuario, ranking };
    favoritos.push(newFavorite);
    res.status(201).json({ 
        message: "Canción marcada como favorita", 
        favorite: newFavorite // Devuelve el objeto que se acaba de añadir
    }); // Respuesta de éxito con detalles de la canción
});

// Endpoint para obtener las canciones favoritas
app.get('/favoritos', (req, res) => {
    // Devuelve la lista de favoritos
    res.json(favoritos);
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`); // Mensaje en consola al iniciar el servidor
});

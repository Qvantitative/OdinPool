const InscriptionModal = ({ inscription, onClose }) => {
  // Ensure inscription is valid before rendering
  if (!inscription) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 focus:outline-none">Close</button>

        <div className="mt-4">
          {inscription.contentType.startsWith('image/svg+xml') ? (
            <object
              data={`https://ordinals.com/content/${inscription.inscriptionId}`}
              type="image/svg+xml"
              className="w-full h-auto object-cover mb-4"
            >
              <p>SVG image not supported</p>
            </object>
          ) : inscription.contentType.startsWith('image') ? (
            <img
              src={`https://ordinals.com/content/${inscription.inscriptionId}`}
              alt={`Inscription ${inscription.inscriptionId}`}
              className="w-full h-auto object-cover mb-4"
            />
          ) : null}

          <div className="inscription-details">
            <p><strong>Inscription ID:</strong> {inscription.inscriptionId}</p>
            <p><strong>Content Type:</strong> {inscription.contentType}</p>
            <p><strong>Created At:</strong> {new Date(inscription.timestamp * 1000).toLocaleString()}</p>
            <p><strong>Inscription Number:</strong> {inscription.inscriptionNumber}</p>
            <p><strong>Genesis Transaction:</strong> {inscription.genesisTransaction}</p>
            <p><strong>Content Length:</strong> {inscription.contentLength} bytes</p>
            <a href={`https://magiceden.io/ordinals/item-details/${inscription.inscriptionId}`} target="_blank" className="text-blue-400 hover:underline mt-4 inline-block">
              View on Magiceden.io
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InscriptionModal;

const formatDate = (dateString) => {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const InfoCard = ({ title, data }) => {
  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <ul className="space-y-3">
        {data.map((item, idx) => (
          <li key={idx} className="flex items-center gap-3">
            <span className="text-gray-600">{item.icon}</span>
            <div>
              <p className="text-sm text-gray-500">{item.label}</p>
              <p className="font-medium">
                {item.label.toLowerCase() === "dob"
                  ? formatDate(item.value)
                  : item.value || "N/A"}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};


export default InfoCard;
type DepartmentFilterProps = {
  departments: { id: string; name: string }[];
  selected: string;
  onChange: (id: string) => void;
};

export function DepartmentFilter({ departments, selected, onChange }: DepartmentFilterProps) {
  return (
    <div role="group" aria-label="Filter by team" className="team-filter">
      {departments.map((dept) => (
        <button
          key={dept.id}
          type="button"
          aria-pressed={dept.id === selected}
          className="team-filter-button"
          onClick={() => onChange(dept.id)}
        >
          {dept.name}
        </button>
      ))}
    </div>
  );
}

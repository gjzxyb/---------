type OrganizationNode = {
  id: string;
  name: string;
  parentId: string | null;
  type: string;
};

export type FlattenedOrganization<T extends OrganizationNode> = T & {
  depth: number;
  path: string;
};

const TYPE_RANK: Record<string, number> = {
  SCHOOL: 1,
  DEPARTMENT: 2,
  CLASS: 3,
};

function compareOrganizations(
  first: OrganizationNode,
  second: OrganizationNode,
) {
  const typeDelta =
    (TYPE_RANK[first.type] ?? 99) - (TYPE_RANK[second.type] ?? 99);

  return typeDelta || first.name.localeCompare(second.name, "zh-CN");
}

export function flattenOrganizationTree<T extends OrganizationNode>(
  organizations: T[],
): FlattenedOrganization<T>[] {
  const organizationIds = new Set(organizations.map((item) => item.id));
  const childrenByParentId = new Map<string | null, T[]>();

  organizations.forEach((organization) => {
    const parentId =
      organization.parentId && organizationIds.has(organization.parentId)
        ? organization.parentId
        : null;
    const siblings = childrenByParentId.get(parentId) ?? [];

    siblings.push(organization);
    childrenByParentId.set(parentId, siblings);
  });

  childrenByParentId.forEach((siblings) => {
    siblings.sort(compareOrganizations);
  });

  const flattened: FlattenedOrganization<T>[] = [];
  const visitedIds = new Set<string>();

  function visit(organization: T, depth: number, ancestorNames: string[]) {
    if (visitedIds.has(organization.id)) {
      return;
    }

    visitedIds.add(organization.id);

    const pathParts = [...ancestorNames, organization.name];
    flattened.push({
      ...organization,
      depth,
      path: pathParts.join(" / "),
    });

    (childrenByParentId.get(organization.id) ?? []).forEach((child) => {
      visit(child, depth + 1, pathParts);
    });
  }

  (childrenByParentId.get(null) ?? []).forEach((organization) => {
    visit(organization, 0, []);
  });

  return flattened;
}

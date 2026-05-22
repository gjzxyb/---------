import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Questionnaire } from "../../components/questionnaire";

describe("Questionnaire", () => {
  it("renders satisfaction labels instead of numeric scale labels", () => {
    render(
      <Questionnaire
        assignmentId="assignment-1"
        questions={[
          {
            description: null,
            id: "question-1",
            maxScore: 5,
            required: true,
            sortOrder: 1,
            title: "课堂教学满意度",
            type: "SCALE",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("A.非常满意").value).toBe("5");
    expect(screen.getByLabelText<HTMLInputElement>("B.满意").value).toBe("4");
    expect(screen.getByLabelText<HTMLInputElement>("E.不满意").value).toBe("1");
  });

  it("renders only three options for a three-point scale", () => {
    render(
      <Questionnaire
        assignmentId="assignment-1"
        questions={[
          {
            description: null,
            id: "question-1",
            maxScore: 3,
            required: true,
            sortOrder: 1,
            title: "课堂教学满意度",
            type: "SCALE",
          },
        ]}
      />,
    );

    expect(screen.getByLabelText<HTMLInputElement>("A.非常满意").value).toBe("3");
    expect(screen.getByLabelText<HTMLInputElement>("B.满意").value).toBe("2");
    expect(screen.getByLabelText<HTMLInputElement>("C.一般").value).toBe("1");
    expect(screen.queryByLabelText("D.不太满意")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E.不满意")).not.toBeInTheDocument();
  });

  it("hides imported category and option metadata from scale questions", () => {
    render(
      <Questionnaire
        assignmentId="assignment-1"
        questions={[
          {
            description:
              "分类：师德师风；选项：A.非常满意|B.满意|C.一般|D.不太满意|E.不满意",
            id: "question-1",
            maxScore: 5,
            required: true,
            sortOrder: 1,
            title: "不在教室内玩手机、接打电话",
            type: "SCALE",
          },
        ]}
      />,
    );

    expect(screen.queryByText(/分类：/)).not.toBeInTheDocument();
    expect(screen.queryByText(/选项：/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("A.非常满意")).toBeInTheDocument();
  });

  it("keeps ordinary question descriptions visible", () => {
    render(
      <Questionnaire
        assignmentId="assignment-1"
        questions={[
          {
            description: "请结合课堂体验填写。",
            id: "question-1",
            maxScore: 5,
            required: true,
            sortOrder: 1,
            title: "课堂教学满意度",
            type: "SCALE",
          },
        ]}
      />,
    );

    expect(screen.getByText("请结合课堂体验填写。")).toBeInTheDocument();
  });

  it("hides imported category-only metadata from scale questions", () => {
    render(
      <Questionnaire
        assignmentId="assignment-1"
        questions={[
          {
            description: "分类：师德师风",
            id: "question-1",
            maxScore: 5,
            required: true,
            sortOrder: 1,
            title: "课堂教学满意度",
            type: "SCALE",
          },
        ]}
      />,
    );

    expect(screen.queryByText(/分类：/)).not.toBeInTheDocument();
  });
});
